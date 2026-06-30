import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DiscordWebhookService, SupabaseClientProvider } from '@catalogohoy/core';
import {
  findCountryByCode,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { IconComponent } from '@ui';
import {
  BillingPeriod,
  CATALOG_ADDON_PRICE,
  convertUsdToLocal,
  CURRENCY_SYMBOLS,
  PaymentCurrency,
  Plan,
  PLAN_BASE_PRICES,
  PlanDisplay,
  PlanFeature,
  resolveCheckoutCurrency,
} from '../../domain';
import { PlanStore } from '../../infrastructure';

const BILLING_CONFIG: Record<BillingPeriod, { label: string; months: number; discount: number }> = {
  monthly:   { label: 'Mensual',     months: 1,  discount: 0    },
  quarterly: { label: 'Trimestral',  months: 3,  discount: 0.10 },
  annual:    { label: 'Anual',       months: 12, discount: 0.15 },
};

type PlanUIConfig = {
  period: string;
  features: PlanFeature[];
  buttonLabel: string;
  buttonSeverity: 'primary' | 'secondary';
  isPopular: boolean;
  color: string;
};

const PLAN_UI_CONFIG: Record<string, PlanUIConfig> = {
  gratis: {
    period: 'por siempre',
    features: [
      { text: '1 catálogo' },
      { text: 'Edición limitada del catálogo' },
      { text: '1 reporte por mes' },
      { text: '15 créditos de IA por mes' },
      // Negatives stay grouped at the end so the cross icons render
      // together as a "what you don't get" block instead of being
      // sprinkled between checks.
      { text: 'Sin analíticas del catálogo', negative: true },
    ],
    buttonLabel: 'Empezar gratis',
    buttonSeverity: 'secondary',
    isPopular: false,
    color: '#64748b',
  },
  basico: {
    period: '/mes',
    features: [
      { text: '1 catálogo' },
      { text: 'Todos los módulos disponibles' },
      { text: 'Analíticas del catálogo' },
      { text: 'Hasta 10 reportes por mes' },
      { text: '200 créditos de IA por mes' },
      { text: 'Diseño personalizable' },
      { text: 'Soporte prioritario' },
    ],
    buttonLabel: 'Comenzar ahora',
    buttonSeverity: 'primary',
    isPopular: true,
    color: '#6366f1',
  },
  avanzado: {
    period: '/mes',
    features: [
      { text: '2 catálogos' },
      { text: 'Todo del plan Básico' },
      { text: 'Analíticas del catálogo' },
      { text: 'Hasta 30 reportes por mes' },
      { text: '500 créditos de IA por mes' },
      { text: 'Vinculación de dominio personalizado (dominio aparte)' },
      { text: 'Soporte dedicado' },
    ],
    buttonLabel: 'Comenzar ahora',
    buttonSeverity: 'secondary',
    isPopular: false,
    color: '#7c3aed',
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
  imports: [IconComponent, DecimalPipe],
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

  public readonly billingOptions: { key: BillingPeriod; label: string; savingsLabel?: string }[] = [
    { key: 'monthly',   label: 'Mensual' },
    { key: 'quarterly', label: 'Trimestral', savingsLabel: '10% off' },
    { key: 'annual',    label: 'Anual',      savingsLabel: '15% off' },
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

  public readonly plans = computed<PlanDisplay[]>(() =>
    this.planStore
      .plans()
      .map((plan) => toPlanDisplay(plan, this.currentPlanPosition(), this.currencyCode()))
  );

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

  public getPeriodPrice(plan: PlanDisplay): number {
    if (plan.isFree) return 0;
    const { months, discount } = BILLING_CONFIG[this.billingPeriod()];
    const baseUsd = this.getBasePrice(plan) * months * (1 - discount);
    return convertUsdToLocal(baseUsd, this.displayCurrency());
  }

  public getMonthlyEquivalent(plan: PlanDisplay): number {
    if (plan.isFree) return 0;
    const { discount } = BILLING_CONFIG[this.billingPeriod()];
    const baseUsd = this.getBasePrice(plan) * (1 - discount);
    return convertUsdToLocal(baseUsd, this.displayCurrency());
  }

  public isUpgradePlan(plan: PlanDisplay): boolean {
    return this.hasPaidPlan() && !plan.isCurrent && !plan.isFree && plan.position > this.currentPlanPosition();
  }

  public getUpgradePrice(plan: PlanDisplay): number {
    const currentPrice = PLAN_BASE_PRICES[this.planStore.currentPlan()?.id ?? ''] ?? 0;
    const targetPrice = PLAN_BASE_PRICES[plan.id] ?? 0;
    const diffUsd = targetPrice - currentPrice;
    const { months, discount } = BILLING_CONFIG[this.billingPeriod()];
    return convertUsdToLocal(diffUsd * months * (1 - discount), this.displayCurrency());
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
