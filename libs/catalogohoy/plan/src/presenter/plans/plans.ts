import { DecimalPipe } from '@angular/common';
import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DiscordWebhookService, SupabaseClientProvider } from '@catalogohoy/core';
import {
  findCountryByCode,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { TranslocoPipe } from '@jsverse/transloco';
import { SkeletonModule } from 'primeng/skeleton';
import { IconComponent } from '@ui';
import {
  BillingPeriod,
  CATALOG_ADDON_PRICE,
  convertUsdToLocal,
  CURRENCY_SYMBOLS,
  ENTERPRISE_PLAN_ID,
  PaymentCurrency,
  Plan,
  PLAN_BASE_PRICES,
  PLAN_FEATURES,
  PlanDisplay,
  PlanFeature,
  resolveCheckoutCurrency,
} from '../../domain';
import { PlanStore } from '../../infrastructure';
import { EnterpriseContactDialog } from '../enterprise-contact-dialog/enterprise-contact-dialog';

/** Card Enterprise ("Hablemos") oculta del grid por ahora — dejaba las cards
 *  de los 3 planes muy angostas. Flip a true para volver al grid de 4.
 *  El funnel (dialog + edge function + panel interno) sigue intacto. */
const ENTERPRISE_CARD_VISIBLE = false;

// quarterly: 10% off. annual: meses gratis por plan (ver ANNUAL_FREE_MONTHS).
const BILLING_CONFIG: Record<BillingPeriod, { label: string; months: number; discount: number }> = {
  monthly:   { label: 'Mensual',     months: 1,  discount: 0    },
  quarterly: { label: 'Trimestral',  months: 3,  discount: 0.10 },
  annual:    { label: 'Anual',       months: 12, discount: 0    },
};

// Meses gratis del plan ANUAL, por plan: Básico 1, Pro/Avanzado 2.
const ANNUAL_FREE_MONTHS: Record<string, number> = { basico: 1, pro: 2, avanzado: 2 };
const annualFreeMonthsFor = (planId: string): number => ANNUAL_FREE_MONTHS[planId] ?? 1;

type PlanUIConfig = {
  period: string;
  features: PlanFeature[];
  buttonLabel: string;
  buttonSeverity: 'primary' | 'secondary';
  isPopular: boolean;
  color: string;
};

// Los features viven en PLAN_FEATURES (domain) — misma fuente que la sección
// "Tu plan incluye" de Mi Perfil.
const PLAN_UI_CONFIG: Record<string, PlanUIConfig> = {
  gratis: {
    period: 'por siempre',
    features: PLAN_FEATURES['gratis'],
    buttonLabel: 'Empezar gratis',
    buttonSeverity: 'secondary',
    isPopular: false,
    color: '#64748b',
  },
  basico: {
    period: '/mes',
    features: PLAN_FEATURES['basico'],
    buttonLabel: 'Comenzar ahora',
    buttonSeverity: 'secondary',
    isPopular: false,
    color: '#6366f1',
  },
  // El badge "Más popular" vive en el Pro (ancla la decisión en el plan del
  // medio); el Avanzado queda como tier premium sin badge.
  pro: {
    period: '/mes',
    features: PLAN_FEATURES['pro'],
    buttonLabel: 'Comenzar ahora',
    buttonSeverity: 'primary',
    isPopular: true,
    color: '#7c3aed',
  },
  avanzado: {
    period: '/mes',
    features: PLAN_FEATURES['avanzado'],
    buttonLabel: 'Comenzar ahora',
    buttonSeverity: 'secondary',
    isPopular: false,
    color: '#312e81',
  },
};

function toPlanDisplay(plan: Plan, currentPlanPosition: number, rateType: string): PlanDisplay {
  const config = PLAN_UI_CONFIG[plan.id] ?? PLAN_UI_CONFIG['gratis'];
  const isCurrent = currentPlanPosition >= 0 && plan.position === currentPlanPosition;

  let buttonLabel = config.buttonLabel;
  if (isCurrent) {
    buttonLabel = 'Plan actual';
  } else if (!plan.isFree && currentPlanPosition > 0) {
    buttonLabel = plan.position > currentPlanPosition ? 'Mejorar plan' : 'Cambiar plan';
  } else if (currentPlanPosition >= 0 && plan.position > currentPlanPosition) {
    buttonLabel = 'Mejorar';
  }

  const teamLabel = plan.maxTeamMembers === 0
    ? 'Sin equipo de trabajo'
    : plan.maxTeamMembers === 1
      ? '1 miembro de equipo'
      : `Hasta ${plan.maxTeamMembers} miembros de equipo`;

  const productsLabel = plan.maxProducts <= 0
    ? '∞ productos'
    : `Hasta ${plan.maxProducts} productos`;

  return {
    ...plan,
    period: config.period,
    maxProductsLabel: productsLabel,
    teamMembersLabel: teamLabel,
    rateType,
    features: config.features,
    additionalCatalogPrice: '',
    buttonLabel,
    buttonSeverity: config.buttonSeverity,
    isPopular: config.isPopular,
    color: config.color,
    isCurrent,
  };
}

@Component({
  selector: 'lib-plans',
  imports: [IconComponent, DecimalPipe, EnterpriseContactDialog, SkeletonModule, TranslocoPipe],
  templateUrl: './plans.html',
  styleUrl: './plans.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export class Plans implements OnInit {
  public readonly planStore = inject(PlanStore);
  private readonly router = inject(Router);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly discord = inject(DiscordWebhookService);
  private readonly supabase = SupabaseClientProvider.getInstance();

  public readonly billingPeriod = signal<BillingPeriod>('monthly');

  /** Contenedor scrolleable de las cards, para las flechas del carousel en
   *  laptops chicas (768–1279 px). */
  private readonly plansGrid = viewChild<ElementRef<HTMLElement>>('plansGrid');

  /** Desplaza el carousel ~una card en la dirección dada (-1 izq / 1 der). */
  public scrollPlans(dir: -1 | 1): void {
    const el = this.plansGrid()?.nativeElement;
    if (!el) return;
    const card = el.querySelector('.plan-card') as HTMLElement | null;
    const amount = card ? card.offsetWidth + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  }

  public readonly billingOptions: { key: BillingPeriod; label: string; savingsLabel?: string }[] = [
    { key: 'monthly',   label: 'Mensual' },
    { key: 'quarterly', label: 'Trimestral', savingsLabel: '10% off' },
    { key: 'annual',    label: 'Anual',      savingsLabel: '2 meses gratis' },
  ];

  // Resolve the currency we'll charge in, driven by the tenant's country.
  // VE always falls back to USD; unsupported countries fall back to USD.
  public readonly displayCurrency = computed<PaymentCurrency>(() => {
    const code = this.tenantCurrency.countryCode();
    const country = findCountryByCode(code);
    return resolveCheckoutCurrency(code, country?.defaultCurrency);
  });

  public readonly currencySymbol = computed(
    () => CURRENCY_SYMBOLS[this.displayCurrency()] ?? '$'
  );

  public readonly currencyCode = computed(
    () => this.displayCurrency().toUpperCase()
  );

  /** CLP / PYG etc. — hide the decimal part. */
  public readonly isZeroDecimalCurrency = computed(() => {
    const c = this.displayCurrency();
    return c === 'clp' || c === 'pyg';
  });

  public readonly currentPlanPosition = computed(
    () => this.planStore.currentPlan()?.position ?? -1
  );

  public readonly hasPaidPlan = computed(
    () => this.currentPlanPosition() > 0
  );

  public readonly isVenezuela = computed(() => this.tenantCurrency.isVenezuela());

  /** Si el tenant es referido con un referral pending, el porcentaje de
   *  descuento que va a recibir automáticamente al pagar su PRIMER plan.
   *  Null = no aplica (sin referido o ya pagó antes). */
  public readonly referralDiscountPct = signal<number | null>(null);

  // Enterprise no se renderiza como card del grid: tiene su propia banda
  // debajo (sin precio ni checkout self-service).
  public readonly plans = computed<PlanDisplay[]>(() =>
    this.planStore
      .plans()
      .filter((plan) => plan.id !== ENTERPRISE_PLAN_ID)
      .map((plan) => toPlanDisplay(plan, this.currentPlanPosition(), this.currencyCode()))
  );

  public readonly isEnterpriseCurrent = computed(
    () => this.planStore.currentPlan()?.id === ENTERPRISE_PLAN_ID
  );

  /** La card Enterprise solo se muestra si el flag está activo o si el tenant
   *  YA es enterprise (asignado por el panel interno) — a ese no se le puede
   *  esconder su plan actual. */
  public readonly showEnterpriseCard = computed(
    () => ENTERPRISE_CARD_VISIBLE || this.isEnterpriseCurrent()
  );

  /** Mientras los planes cargan desde Supabase mostramos skeletons en el grid
   *  completo (incluida la posición de Enterprise) — si no, la card Enterprise
   *  estática aparece sola. Si la carga falla, plans queda vacío e isLoading
   *  en false, así que caemos al grid real y no dejamos skeletons eternos. */
  public readonly isLoadingPlans = computed(
    () => this.planStore.isLoading() && this.plans().length === 0
  );

  // 4 planes: gratis/básico/pro/avanzado (Enterprise oculta — ver ENTERPRISE_CARD_VISIBLE).
  public readonly skeletonCards = [0, 1, 2, 3];

  /** Cantidad de cards visibles (skeletons durante la carga) — decide si el
   *  grid usa 3 o 4 columnas. */
  public readonly gridCardCount = computed(() =>
    this.isLoadingPlans()
      ? this.skeletonCards.length
      : this.plans().length + (this.showEnterpriseCard() ? 1 : 0)
  );
  // 9 filas ≈ las features del plan Avanzado, la card más alta del grid.
  public readonly skeletonFeatureWidths = ['95%', '80%', '90%', '75%', '100%', '85%', '90%', '80%', '70%'];

  private readonly enterpriseDialog = viewChild.required(EnterpriseContactDialog);

  public openEnterpriseDialog(): void {
    this.enterpriseDialog().show();
  }

  async ngOnInit(): Promise<void> {
    this.planStore.loadPlans();
    this.planStore.refreshUsage();
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (tenantId) {
      this.tenantCurrency.load(tenantId);
      this.loadReferralDiscount(tenantId);
    }
  }

  /** Solo aplica si hay referral pending. La RLS de referrals deja al owner
   *  leer su propia fila — perfecto, no exponemos info del referrer. */
  private async loadReferralDiscount(tenantId: number): Promise<void> {
    const { data: referral } = await this.supabase
      .from('referrals')
      .select('status')
      .eq('referred_tenant_id', tenantId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!referral) return;

    const { data: cfg } = await this.supabase
      .from('referral_config')
      .select('referred_discount_pct')
      .eq('id', 1)
      .maybeSingle();

    const pct = (cfg?.referred_discount_pct as number | undefined) ?? 20;
    this.referralDiscountPct.set(pct);
  }

  /** Precio mostrado del plan ya con el descuento de referido aplicado.
   *  Para gratis devuelve 0, para upgrade pricing usa la diferencia (sin
   *  descuento porque el referral solo aplica al primer pago, no a upgrades). */
  public getReferralDiscountedPrice(plan: PlanDisplay): number {
    const pct = this.referralDiscountPct();
    if (!pct || plan.isFree || this.isUpgradePlan(plan)) {
      return this.getPeriodPrice(plan);
    }
    return this.getPeriodPrice(plan) * (1 - pct / 100);
  }

  public hasReferralDiscount(plan: PlanDisplay): boolean {
    return (
      this.referralDiscountPct() != null &&
      !plan.isFree &&
      !this.isUpgradePlan(plan) &&
      !plan.isCurrent
    );
  }

  public getBasePrice(plan: PlanDisplay): number {
    if (plan.isFree) return 0;
    return PLAN_BASE_PRICES[plan.id] ?? plan.price;
  }

  /** Meses que se pagan en el período. En anual, los meses gratis dependen del
   *  plan (Básico 1, Pro/Avanzado 2). */
  private paidMonths(planId: string): number {
    const period = this.billingPeriod();
    if (period === 'annual') return 12 - annualFreeMonthsFor(planId);
    const { months, discount } = BILLING_CONFIG[period];
    return months * (1 - discount);
  }

  public getPeriodPrice(plan: PlanDisplay): number {
    if (plan.isFree) return 0;
    const baseUsd = this.getBasePrice(plan) * this.paidMonths(plan.id);
    return convertUsdToLocal(baseUsd, this.displayCurrency());
  }

  public getMonthlyEquivalent(plan: PlanDisplay): number {
    if (plan.isFree) return 0;
    const { months } = BILLING_CONFIG[this.billingPeriod()];
    const baseUsd = (this.getBasePrice(plan) * this.paidMonths(plan.id)) / months;
    return convertUsdToLocal(baseUsd, this.displayCurrency());
  }

  /** Es el período anual (para mostrar el gancho "N meses gratis" por card). */
  public isAnnual(): boolean {
    return this.billingPeriod() === 'annual';
  }

  /** Label del gancho anual por plan: "1 mes gratis" / "2 meses gratis". */
  public annualFreeLabel(plan: PlanDisplay): string {
    const n = annualFreeMonthsFor(plan.id);
    return n === 1 ? '1 mes gratis' : `${n} meses gratis`;
  }

  public isUpgradePlan(plan: PlanDisplay): boolean {
    return this.hasPaidPlan() && !plan.isCurrent && !plan.isFree && plan.position > this.currentPlanPosition();
  }

  public getUpgradePrice(plan: PlanDisplay): number {
    const currentPrice = PLAN_BASE_PRICES[this.planStore.currentPlan()?.id ?? ''] ?? 0;
    const targetPrice = PLAN_BASE_PRICES[plan.id] ?? 0;
    const diffUsd = targetPrice - currentPrice;
    return convertUsdToLocal(diffUsd * this.paidMonths(plan.id), this.displayCurrency());
  }

  public getPeriodLabel(plan: PlanDisplay): string {
    if (plan.isFree) return 'por siempre';
    const period = this.billingPeriod();
    if (period === 'monthly')   return '/mes';
    if (period === 'quarterly') return '/trimestre';
    return '/año';
  }

  public getCatalogAddonPrice(): number {
    return convertUsdToLocal(CATALOG_ADDON_PRICE, this.displayCurrency());
  }

  public selectPlan(plan: PlanDisplay): void {
    if (plan.isCurrent || plan.isFree) return;

    this.discord.notifyCheckoutIntent({
      tenantName: this.tenantStore.tenantName(),
      tenantSlug: this.tenantStore.tenantSlug(),
      planName: plan.name,
      billingPeriod: this.billingPeriod(),
    });

    this.router.navigate(['/admin/plans/checkout', plan.id], {
      queryParams: {
        period: this.billingPeriod(),
      },
    });
  }
}
