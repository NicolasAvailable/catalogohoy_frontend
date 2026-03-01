import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from '@ui';
import {
  BillingPeriod,
  CATALOG_ADDON_PRICE_BY_CURRENCY,
  PaymentCurrency,
  Plan,
  PLAN_BASE_PRICES,
  PlanDisplay,
  PlanFeature,
} from '../../domain';
import { PlanStore } from '../../infrastructure';

const BILLING_CONFIG: Record<BillingPeriod, { label: string; months: number; discount: number }> = {
  monthly:   { label: 'Mensual',     months: 1,  discount: 0    },
  quarterly: { label: 'Trimestral',  months: 3,  discount: 0.10 },
  annual:    { label: 'Anual',       months: 12, discount: 0.15 },
};

type PlanUIConfig = {
  period: string;
  rateType: string;
  features: PlanFeature[];
  buttonLabel: string;
  buttonSeverity: 'primary' | 'secondary';
  isPopular: boolean;
  color: string;
};

const PLAN_UI_CONFIG: Record<string, PlanUIConfig> = {
  gratis: {
    period: 'por siempre',
    rateType: 'Gratis',
    features: [
      { text: '1 catálogo' },
      { text: 'Edición limitada del catálogo' },
      { text: 'No permite descargar QR del catálogo' },
    ],
    buttonLabel: 'Empezar gratis',
    buttonSeverity: 'secondary',
    isPopular: false,
    color: '#64748b',
  },
  basico: {
    period: '/mes',
    rateType: 'USD',
    features: [
      { text: '1 catálogo' },
      { text: 'Todos los módulos disponibles' },
      { text: 'Analíticas del catálogo' },
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
    rateType: 'USD',
    features: [
      { text: '1 catálogo' },
      { text: 'Todo del plan Básico' },
      { text: 'Analíticas del catálogo' },
      { text: 'Dominio personalizado' },
      { text: 'Soporte dedicado' },
    ],
    buttonLabel: 'Comenzar ahora',
    buttonSeverity: 'secondary',
    isPopular: false,
    color: '#7c3aed',
  },
};

function toPlanDisplay(plan: Plan, currentPlanPosition: number): PlanDisplay {
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

  return {
    ...plan,
    period: config.period,
    maxProductsLabel: `Hasta ${plan.maxProducts} productos`,
    rateType: config.rateType,
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
  imports: [IconComponent],
  templateUrl: './plans.html',
  styleUrl: './plans.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export class Plans implements OnInit {
  public readonly planStore = inject(PlanStore);
  private readonly router = inject(Router);

  public readonly billingPeriod = signal<BillingPeriod>('monthly');
  public readonly paymentCurrency = signal<PaymentCurrency>('usd');

  public readonly billingOptions: { key: BillingPeriod; label: string; savingsLabel?: string }[] = [
    { key: 'monthly',   label: 'Mensual' },
    { key: 'quarterly', label: 'Trimestral', savingsLabel: '10% off' },
    { key: 'annual',    label: 'Anual',      savingsLabel: '15% off' },
  ];

  public readonly currencyOptions: { key: PaymentCurrency; flag: string; label: string }[] = [
    { key: 'usd', flag: '🇺🇸', label: 'USD' },
    { key: 'ves', flag: '🇻🇪', label: 'Bs.' },
  ];

  private readonly currentPlanPosition = computed(
    () => this.planStore.currentPlan()?.position ?? -1
  );

  public readonly plans = computed<PlanDisplay[]>(() =>
    this.planStore.plans().map((plan) => toPlanDisplay(plan, this.currentPlanPosition()))
  );

  ngOnInit(): void {
    this.planStore.loadPlans();
    this.planStore.loadTenantPlanUsage();
  }

  public getBasePrice(plan: PlanDisplay): number {
    if (plan.isFree) return 0;
    return PLAN_BASE_PRICES[this.paymentCurrency()][plan.id] ?? plan.price;
  }

  public getPeriodPrice(plan: PlanDisplay): number {
    if (plan.isFree) return 0;
    const { months, discount } = BILLING_CONFIG[this.billingPeriod()];
    const base = this.getBasePrice(plan);
    return Math.round(base * months * (1 - discount) * 100) / 100;
  }

  public getMonthlyEquivalent(plan: PlanDisplay): number {
    if (plan.isFree) return 0;
    const { discount } = BILLING_CONFIG[this.billingPeriod()];
    const base = this.getBasePrice(plan);
    return Math.round(base * (1 - discount) * 100) / 100;
  }

  public getPeriodLabel(plan: PlanDisplay): string {
    if (plan.isFree) return 'por siempre';
    const period = this.billingPeriod();
    if (period === 'monthly')   return '/mes';
    if (period === 'quarterly') return '/trimestre';
    return '/año';
  }

  public getCatalogAddonPrice(): number {
    return CATALOG_ADDON_PRICE_BY_CURRENCY[this.paymentCurrency()];
  }

  public selectPlan(plan: PlanDisplay): void {
    if (plan.isCurrent || plan.isFree) return;

    this.router.navigate(['/admin/plans/checkout', plan.id], {
      queryParams: {
        period:   this.billingPeriod(),
        currency: this.paymentCurrency(),
      },
    });
  }
}
