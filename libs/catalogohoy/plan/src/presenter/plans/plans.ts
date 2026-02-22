import { Component, computed, inject, OnInit } from '@angular/core';
import { IconComponent } from '@ui';
import { Plan, PlanDisplay, PlanFeature } from '../../domain';
import { PlanStore } from '../../infrastructure';

const WHATSAPP_NUMBER = '584124807708';

type PlanUIConfig = {
  period: string;
  rateType: string;
  features: PlanFeature[];
  additionalCatalogPrice: string;
  buttonLabel: string;
  buttonSeverity: 'primary' | 'secondary';
  isPopular: boolean;
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
  },
  basico: {
    period: '/mes',
    rateType: 'A BCV',
    features: [
      { text: '1 catálogo' },
      { text: 'Todos los módulos disponibles' },
      { text: 'Diseño personalizable' },
      { text: 'Soporte prioritario' },
    ],
    additionalCatalogPrice: '$6.99/mes',
    buttonLabel: 'Comenzar ahora',
    buttonSeverity: 'primary',
    isPopular: true,
  },
  avanzado: {
    period: '/mes',
    rateType: 'A BCV',
    features: [
      { text: '1 catálogo' },
      { text: 'Todo del plan Básico' },
      { text: 'Dominio personalizado' },
      { text: 'Soporte dedicado' },
    ],
    additionalCatalogPrice: '$6.99/mes',
    buttonLabel: 'Comenzar ahora',
    buttonSeverity: 'secondary',
    isPopular: false,
  },
};

function toPlanDisplay(plan: Plan): PlanDisplay {
  const config = PLAN_UI_CONFIG[plan.id] ?? PLAN_UI_CONFIG['gratis'];
  return {
    ...plan,
    period: config.period,
    maxProductsLabel: `Hasta ${plan.maxProducts} productos`,
    rateType: config.rateType,
    features: config.features,
    additionalCatalogPrice: config.additionalCatalogPrice,
    buttonLabel: config.buttonLabel,
    buttonSeverity: config.buttonSeverity,
    isPopular: config.isPopular,
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

  public readonly plans = computed<PlanDisplay[]>(() =>
    this.planStore.plans().map(toPlanDisplay)
  );

  ngOnInit(): void {
    this.planStore.loadPlans();
  }

  public selectPlan(plan: PlanDisplay): void {
    if (plan.isFree) {
      return;
    }

    const message = encodeURIComponent(
      `Hola, me interesa adquirir el plan *${plan.name}* ($${plan.price}${plan.period}) de CatálogoHoy. ¿Me pueden dar más información?`
    );
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    window.open(url, '_blank');
  }
}
