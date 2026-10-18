import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { RevenueCatService } from '@catalogohoy/core';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, IconComponent } from '@ui';
import { PLAN_FEATURES } from '../../domain';
import { PlanStore } from '../../infrastructure/plan.store';

type Period = 'monthly' | 'annual';

/** Una tarjeta de plan en la paywall: el plan + sus packages de RevenueCat. */
interface PlanCard {
  id: string;
  name: string;
  tagline: string;
  features: string[];
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
}

const PLAN_ORDER = ['basico', 'pro', 'avanzado'];

/** Nombre + resumen de cada plan. Las FEATURES salen de PLAN_FEATURES (domain,
 *  la MISMA fuente que usa la página de planes de la web) → lista completa y sin
 *  drift. NO depende de la carga de `plans()` (evita el fallback a "basico" en
 *  minúscula). El precio sale localizado del store (RevenueCat priceString). */
const PLAN_INFO: Record<string, { name: string; tagline: string }> = {
  basico: { name: 'Plan Básico', tagline: 'Para empezar a vender online.' },
  pro: { name: 'Plan Pro', tagline: 'Para tiendas que venden todos los días.' },
  avanzado: { name: 'Plan Avanzado', tagline: 'Para negocios con muchos productos.' },
};

/**
 * Paywall de compra de plan por IAP de Apple (RevenueCat) — SOLO iOS. Es lo que
 * `/admin/plans` renderiza en la app de iOS (en web sigue la página de Stripe).
 * Lee la oferta vigente de RevenueCat, muestra los planes con el precio del
 * store (localizado) y un toggle mensual/anual, compra con Apple y al confirmar
 * refresca el PlanStore (el webhook `revenuecat-webhook` ya escribió el plan).
 */
@Component({
  selector: 'lib-iap-paywall',
  standalone: true,
  imports: [TranslocoPipe, ButtonComponent, IconComponent],
  templateUrl: './iap-paywall.html',
  styleUrl: './iap-paywall.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IapPaywall implements OnInit {
  private readonly revenueCat = inject(RevenueCatService);
  private readonly planStore = inject(PlanStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  public readonly loading = signal(true);
  // Arranca en MENSUAL (como la web): el número anual, más alto, asusta. El
  // usuario cambia a Anual si quiere el -50%.
  public readonly period = signal<Period>('monthly');
  public readonly cards = signal<PlanCard[]>([]);
  /** id del plan cuya compra está en curso (deshabilita los botones). */
  public readonly purchasing = signal<string | null>(null);
  public readonly restoring = signal(false);
  /** Nombre del plan recién activado → pantalla de éxito antes de ir al admin. */
  public readonly successName = signal<string | null>(null);

  /** Si ya hay una suscripción Stripe ACTIVA (web), no se permite comprar por
   *  IAP (evita doble cobro): se muestra un aviso para gestionarla en la web. */
  public readonly blockedByStripe = computed(
    () => this.planStore.tenantPlanUsage()?.stripeSubscriptionStatus === 'active'
  );

  public readonly currentPlanId = computed(
    () => this.planStore.currentPlan()?.id ?? 'gratis'
  );

  async ngOnInit(): Promise<void> {
    this.planStore.loadPlans();
    // Asegura tener el plan actual cargado para el guard de Stripe / "plan actual".
    void this.planStore.refreshUsage();

    const offering = await this.revenueCat.getCurrentOffering();
    if (!offering) {
      this.loading.set(false);
      return;
    }
    this.cards.set(this.buildCards(offering.availablePackages));
    this.loading.set(false);
  }

  /** Arma las tarjetas emparejando los packages `ch_{plan}_{period}` con los
   *  datos del plan (nombre/descripción/límites) del PlanStore. */
  private buildCards(packages: PurchasesPackage[]): PlanCard[] {
    const byPlan = new Map<string, { monthly: PurchasesPackage | null; annual: PurchasesPackage | null }>();
    for (const pkg of packages) {
      // El separador plan↔período difiere por store: iOS usa guion bajo
      // (`ch_basico_monthly`), Google Play usa dos puntos en el formato
      // `productId:basePlanId` (`ch_basico:monthly`). Aceptamos ambos — si no,
      // en Android no matcheaba ningún package y la paywall salía vacía.
      const m = pkg.product.identifier.match(
        /^ch_(basico|pro|avanzado)[_:](monthly|annual)/i
      );
      if (!m) continue;
      const plan = m[1].toLowerCase();
      const per = m[2].toLowerCase() as Period;
      const slot = byPlan.get(plan) ?? { monthly: null, annual: null };
      slot[per] = pkg;
      byPlan.set(plan, slot);
    }

    return PLAN_ORDER.filter((id) => byPlan.has(id)).map((id) => {
      const info = PLAN_INFO[id] ?? { name: id, tagline: '' };
      const slot = byPlan.get(id)!;
      // Features completas de PLAN_FEATURES (domain); solo las positivas.
      const features = (PLAN_FEATURES[id] ?? [])
        .filter((f) => !f.negative)
        .map((f) => f.text);
      return {
        id,
        name: info.name,
        tagline: info.tagline,
        features,
        monthly: slot.monthly,
        annual: slot.annual,
      };
    });
  }

  public setPeriod(p: Period): void {
    this.period.set(p);
  }

  public packageFor(card: PlanCard): PurchasesPackage | null {
    return this.period() === 'annual' ? card.annual : card.monthly;
  }

  /** Precio localizado del store para el período elegido. */
  public priceLabel(card: PlanCard): string {
    return this.packageFor(card)?.product.priceString ?? '';
  }

  public isCurrent(card: PlanCard): boolean {
    return this.currentPlanId() === card.id;
  }

  async buy(card: PlanCard): Promise<void> {
    if (this.purchasing() || this.blockedByStripe()) return;
    const pkg = this.packageFor(card);
    if (!pkg) return;

    this.purchasing.set(card.id);
    const outcome = await this.revenueCat.purchase(pkg);

    if (outcome.cancelled) {
      this.purchasing.set(null);
      return;
    }
    if (!outcome.ok) {
      this.purchasing.set(null);
      this.toast.warning('No se pudo completar la compra. Intenta de nuevo.');
      return;
    }

    // Compra OK: el webhook de RevenueCat escribe el plan en el tenant. Hacemos
    // polling del PlanStore hasta verlo reflejado (o nos rendimos y confiamos).
    const applied = await this.waitForPlan(card.id);
    this.purchasing.set(null);
    this.successName.set(card.name);
    if (!applied) {
      // El webhook puede tardar unos segundos; igual mostramos éxito y el admin
      // lo reflejará al refrescar. No bloqueamos al usuario que ya pagó.
    }
  }

  /** Reintenta `refreshUsage()` hasta que el plan activo sea el comprado. */
  private async waitForPlan(planId: string): Promise<boolean> {
    for (let i = 0; i < 8; i++) {
      await this.planStore.refreshUsage();
      if (this.planStore.currentPlan()?.id === planId) return true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return this.planStore.currentPlan()?.id === planId;
  }

  async restore(): Promise<void> {
    if (this.restoring()) return;
    this.restoring.set(true);
    const info = await this.revenueCat.restore();
    if (info && Object.keys(info.entitlements.active).length > 0) {
      await this.waitForAnyPaidPlan();
      this.toast.success('Compras restauradas.');
    } else {
      this.toast.warning('No encontramos compras para restaurar.');
    }
    this.restoring.set(false);
  }

  private async waitForAnyPaidPlan(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      await this.planStore.refreshUsage();
      if (!this.planStore.isFreePlan()) return;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  public goToAdmin(): void {
    void this.router.navigateByUrl('/admin');
  }
}
