import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IconComponent } from '@ui';
import { Plan, PlanDisplay, PlanFeature } from '../../domain';
import { PlanStore } from '../../infrastructure';

const WHATSAPP_NUMBER = '584124807708';

export type BillingPeriod = 'monthly' | 'quarterly' | 'annual';

const BILLING_CONFIG: Record<BillingPeriod, { label: string; months: number; discount: number }> = {
  monthly:   { label: 'Mensual',     months: 1,  discount: 0    },
  quarterly: { label: 'Trimestral',  months: 3,  discount: 0.10 },
  annual:    { label: 'Anual',       months: 12, discount: 0.15 },
};

type PlanUIConfig = {
  period: string;
  rateType: string;
  features: PlanFeature[];
  additionalCatalogPrice: string;
  buttonLabel: string;
  buttonSeverity: 'primary' | 'secondary';
  isPopular: boolean;
  color: string;
};

const PLAN_UI_CONFIG: Record<string, PlanUIConfig> = {
  gratis: {
    period: 'por siempre',
    rateType: 'A BCV',
    features: [
      { text: '1 catálogo' },
      { text: 'Edición limitada del catálogo' },
      { text: 'No permite descargar QR del catálogo' },
    ],
    additionalCatalogPrice: '$6.99/mes',
    buttonLabel: 'Empezar gratis',
    buttonSeverity: 'secondary',
    isPopular: false,
    color: '#64748b',
  },
  basico: {
    period: '/mes',
    rateType: 'A BCV',
    features: [
      { text: '1 catálogo' },
      { text: 'Todos los módulos disponibles' },
      { text: 'Analíticas del catálogo' },
      { text: 'Diseño personalizable' },
      { text: 'Soporte prioritario' },
    ],
    additionalCatalogPrice: '$6.99/mes',
    buttonLabel: 'Comenzar ahora',
    buttonSeverity: 'primary',
    isPopular: true,
    color: '#6366f1',
  },
  avanzado: {
    period: '/mes',
    rateType: 'A BCV',
    features: [
      { text: '1 catálogo' },
      { text: 'Todo del plan Básico' },
      { text: 'Analíticas del catálogo' },
      { text: 'Dominio personalizado' },
      { text: 'Soporte dedicado' },
    ],
    additionalCatalogPrice: '$6.99/mes',
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
  } else if (currentPlanPosition >= 0 && plan.position > currentPlanPosition) {
    buttonLabel = 'Mejorar';
  }

  return {
    ...plan,
    period: config.period,
    maxProductsLabel: `Hasta ${plan.maxProducts} productos`,
    rateType: config.rateType,
    features: config.features,
    additionalCatalogPrice: config.additionalCatalogPrice,
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

  public readonly billingPeriod = signal<BillingPeriod>('monthly');

  public readonly billingOptions: { key: BillingPeriod; label: string; savingsLabel?: string }[] = [
    { key: 'monthly',   label: 'Mensual' },
    { key: 'quarterly', label: 'Trimestral', savingsLabel: '10% off' },
    { key: 'annual',    label: 'Anual',      savingsLabel: '15% off' },
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

  /** Precio total del periodo seleccionado (con descuento) */
  public getPeriodPrice(plan: PlanDisplay): number {
    if (plan.isFree) return 0;
    const { months, discount } = BILLING_CONFIG[this.billingPeriod()];
    return Math.round(plan.price * months * (1 - discount) * 100) / 100;
  }

  /** Equivalente mensual para mostrar junto al precio total */
  public getMonthlyEquivalent(plan: PlanDisplay): number {
    if (plan.isFree) return 0;
    const { months, discount } = BILLING_CONFIG[this.billingPeriod()];
    return Math.round(plan.price * (1 - discount) * 100) / 100;
  }

  /** Label del periodo para mostrar bajo el precio */
  public getPeriodLabel(plan: PlanDisplay): string {
    if (plan.isFree) return 'por siempre';
    const period = this.billingPeriod();
    if (period === 'monthly')   return '/mes';
    if (period === 'quarterly') return '/trimestre';
    return '/año';
  }

  public selectPlan(plan: PlanDisplay): void {
    if (plan.isCurrent || plan.isFree) return;

    const price = this.getPeriodPrice(plan);
    const periodLabel = this.getPeriodLabel(plan);
    const message = encodeURIComponent(
      `Hola, me interesa adquirir el plan *${plan.name}* ($${price}${periodLabel}) de CatálogoHoy. ¿Me pueden dar más información?`
    );
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    window.open(url, '_blank');
  }
}
