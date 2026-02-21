import { Component, signal } from '@angular/core';
import { IconComponent } from '@ui';
import { Plan } from '../../domain';

const WHATSAPP_NUMBER = '584124807708';

@Component({
  selector: 'lib-plans',
  imports: [IconComponent],
  templateUrl: './plans.html',
  styleUrl: './plans.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export class Plans {
  public readonly plans = signal<Plan[]>([
    {
      id: 'gratis',
      name: 'Gratis',
      description: 'Para empezar a probar tu catálogo.',
      price: 0,
      period: 'por siempre',
      maxProducts: 'Hasta 10 productos',
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
      isFree: true,
    },
    {
      id: 'basico',
      name: 'Básico',
      description: 'Para tiendas que quieren crecer.',
      price: 14.99,
      period: '/mes',
      maxProducts: 'Hasta 100 productos',
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
      isFree: false,
    },
    {
      id: 'avanzado',
      name: 'Avanzado',
      description: 'Para negocios con muchos productos.',
      price: 29.99,
      period: '/mes',
      maxProducts: 'Hasta 500 productos',
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
      isFree: false,
    },
  ]);

  public selectPlan(plan: Plan): void {
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
