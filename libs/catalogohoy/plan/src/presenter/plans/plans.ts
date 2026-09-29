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
  BASICO_PLAN_ID,
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
import { CheckoutService, PlanStore } from '../../infrastructure';
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

// Anual: 50% de descuento — se paga la mitad del año (6 de 12 meses) en todos los planes.
const ANNUAL_FREE_MONTHS: Record<string, number> = { basico: 6, pro: 6, avanzado: 6 };
const annualFreeMonthsFor = (planId: string): number => ANNUAL_FREE_MONTHS[planId] ?? 6;

type PlanUIConfig = {
  period: string;
  features: PlanFeature[];
  buttonLabel: string;
  buttonSeverity: 'primary' | 'secondary';
  isPopular: boolean;
  color: string;
  /** Prueba social: cantidad de suscriptores a mostrar en un badge ("+N
   *  suscriptores"). Solo los planes que lo definen lo muestran. */
  socialProof?: number;
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
  // medio); el Avanzado lleva un badge de prueba social ("+N suscriptores").
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
    socialProof: 500,
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
    socialProof: config.socialProof,
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
  private readonly checkout = inject(CheckoutService);
  private readonly supabase = SupabaseClientProvider.getInstance();

  public readonly billingPeriod = signal<BillingPeriod>('monthly');

  /** Plan cuya sesión de trial se está creando → botón en "Redirigiendo…". */
  public readonly trialLoading = signal<string | null>(null);

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

  // Solo mensual y anual (el trimestral se retiró 2026-09; el plumbing de
  // 'quarterly' sigue en el type/PRICE_MAP para no romper suscripciones viejas,
  // pero ya no se ofrece).
  public readonly billingOptions: { key: BillingPeriod; label: string; savingsLabel?: string }[] = [
    { key: 'monthly', label: 'Mensual' },
    { key: 'annual',  label: 'Anual', savingsLabel: '-50%' },
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

  /** El Básico ($12) se discontinuó para altas nuevas (2026-09): quedó como
   *  grandfathered para los que ya lo pagan. Se oculta del grid salvo que sea
   *  el plan actual del tenant (a ese no le escondemos su propio plan). */
  public readonly isBasicoCurrent = computed(
    () => this.planStore.currentPlan()?.id === BASICO_PLAN_ID
  );

  // Enterprise no se renderiza como card del grid: tiene su propia banda
  // debajo (sin precio ni checkout self-service). Básico se oculta salvo para
  // quien ya lo tiene (grandfathered).
  public readonly plans = computed<PlanDisplay[]>(() =>
    this.planStore
      .plans()
      .filter((plan) => plan.id !== ENTERPRISE_PLAN_ID)
      .filter((plan) => plan.id !== BASICO_PLAN_ID || this.isBasicoCurrent())
      .map((plan) => toPlanDisplay(plan, this.currentPlanPosition(), this.currencyCode()))
  );

  /** Trial de 7 días: solo aplica en la PRIMERA suscripción (tenant en Gratis,
   *  sin plan pago). Cuando aplica, las cards pagas muestran el badge y el
   *  checkout activa `trial_period_days` en Stripe. */
  public readonly eligibleForTrial = computed(() => !this.hasPaidPlan());

  /** ¿Esta card muestra el gancho "7 días gratis"? Solo planes pagos, no el
   *  actual, y solo si el tenant califica para trial. */
  public showsTrial(plan: PlanDisplay): boolean {
    return this.eligibleForTrial() && !plan.isFree && !plan.isCurrent;
  }

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

  // 3 planes visibles en altas nuevas: gratis/pro/avanzado (Básico oculto salvo
  // grandfathered; Enterprise oculta — ver ENTERPRISE_CARD_VISIBLE).
  public readonly skeletonCards = [0, 1, 2];

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

  /** Precio mensual congelado del tenant (grandfathered, reestructura 2026-09):
   *  los clientes anteriores mantienen su precio viejo en su plan actual hasta
   *  que cancelen. Null = paga el precio de lista. */
  public readonly lockedPlanPrice = computed(
    () => this.planStore.tenantPlanUsage()?.lockedPlanPrice ?? null
  );

  /** ¿Esta card es el plan actual de un cliente con precio congelado? Solo ahí
   *  mostramos el badge y el precio respetado en vez del de lista. */
  public isGrandfathered(plan: PlanDisplay): boolean {
    return plan.isCurrent && this.lockedPlanPrice() != null;
  }

  /** Precio congelado ya convertido a la moneda de cobro (para el display). */
  public getLockedPrice(): number {
    return convertUsdToLocal(this.lockedPlanPrice() ?? 0, this.displayCurrency());
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

  /** Gancho anual: 50% de descuento (equivale a 6 meses pagos de 12). */
  public annualFreeLabel(plan: PlanDisplay): string {
    return plan.id === 'gratis' ? '' : '50% de descuento';
  }

  /** El prorrateo ("solo pagás la diferencia") aplica SOLO si al plan actual le
   *  quedan MÁS de 20 días de vigencia. Cerca del vencimiento se muestra/cobra
   *  el precio completo del plan nuevo (con su descuento anual). */
  public readonly prorationEligible = computed(() => {
    const expiresAt = this.planStore.tenantPlanUsage()?.planExpiresAt;
    if (!expiresAt) return false;
    const daysLeft = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
    return daysLeft > 20;
  });

  public isUpgradePlan(plan: PlanDisplay): boolean {
    return (
      this.hasPaidPlan() &&
      !plan.isCurrent &&
      !plan.isFree &&
      plan.position > this.currentPlanPosition() &&
      this.prorationEligible()
    );
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

    const countryCode = this.tenantCurrency.countryCode();
    const countryName = findCountryByCode(countryCode)?.label ?? null;

    this.discord.notifyCheckoutIntent({
      tenantName: this.tenantStore.tenantName(),
      tenantSlug: this.tenantStore.tenantSlug(),
      planName: plan.name,
      billingPeriod: this.billingPeriod(),
      countryName,
      countryCode,
    });

    // Trial-elegible (usuario sin plan pago) → directo al checkout de Stripe con
    // los 7 días (la edge function aplica trial_period_days), sin pasar por la
    // pantalla interna. Los upgrades/renovaciones siguen por esa pantalla, que
    // maneja prorrateo, cupones, catálogos extra y Pago Móvil (VE).
    if (this.showsTrial(plan)) {
      void this.startTrialCheckout(plan);
      return;
    }

    this.router.navigate(['/admin/plans/checkout', plan.id], {
      queryParams: {
        period: this.billingPeriod(),
      },
    });
  }

  /** Crea la sesión de Stripe (con trial) y redirige DIRECTO a Stripe. */
  private async startTrialCheckout(plan: PlanDisplay): Promise<void> {
    if (this.trialLoading()) return;
    this.trialLoading.set(plan.id);

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.trialLoading.set(null);
      return;
    }
    const code = this.tenantCurrency.countryCode();
    const currency = resolveCheckoutCurrency(code, findCountryByCode(code)?.defaultCurrency);
    const origin = window.location.origin;
    const slug = localStorage.getItem('slug') ?? this.tenantStore.tenantSlug() ?? '';

    const result = await this.checkout.createCheckoutSession({
      planId: plan.id,
      billingPeriod: this.billingPeriod(),
      tenantId,
      successUrl: `${origin}/admin/plans/success?slug=${slug}`,
      cancelUrl: `${origin}/admin/plans`,
      currency,
    });

    result
      .mapRight(({ url }) => {
        window.location.href = url;
      })
      .mapLeft(() => {
        this.trialLoading.set(null);
      });
  }
}
