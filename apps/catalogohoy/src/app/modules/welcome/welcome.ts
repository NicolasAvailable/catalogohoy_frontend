import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BillingPeriod, PlanStore } from '@catalogohoy/plan';
import { IconComponent } from '@ui';

interface TrialPlan {
  id: 'pro' | 'avanzado';
  name: string;
  price: number;
  tagline: string;
  features: string[];
  /** Card destacada (Pro, el plan ancla). */
  highlighted: boolean;
}

/**
 * Pantalla de bienvenida post-registro (Opción B): apenas se registra, el
 * usuario cae en `/bienvenida` (el signup redirige acá; el login sigue yendo a
 * `/admin`). Ofrece arrancar 7 días de prueba de Pro o Avanzado —que llevan al
 * checkout, donde el trial se aplica solo (trial_period_days)— o seguir con el
 * plan gratuito. Full-screen, fuera del layout del admin (como el POS).
 */
@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [IconComponent, TranslocoPipe],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Welcome implements OnInit {
  private readonly router = inject(Router);
  private readonly planStore = inject(PlanStore);

  private readonly period: BillingPeriod = 'monthly';

  protected readonly plans: TrialPlan[] = [
    {
      id: 'pro',
      name: 'Pro',
      price: 20,
      tagline: 'Para tiendas que venden todos los días.',
      features: [
        'Hasta 500 productos',
        'Analíticas del catálogo',
        'Notificaciones de órdenes por WhatsApp',
        '350 créditos de IA por mes',
      ],
      highlighted: true,
    },
    {
      id: 'avanzado',
      name: 'Avanzado',
      price: 35,
      tagline: 'Para negocios con muchos productos.',
      features: [
        'Productos ilimitados',
        'Punto de Venta (caja registradora)',
        'CRM de chats: WhatsApp, Instagram y TikTok',
        'Dominio personalizado',
      ],
      highlighted: false,
    },
  ];

  constructor() {
    // Si el tenant ya tiene un plan pago (no debería en un alta nueva, pero por
    // si alguien entra a /bienvenida a mano), no le ofrecemos el trial: al admin.
    effect(() => {
      const plan = this.planStore.currentPlan();
      if (plan && !plan.isFree) this.router.navigate(['/admin']);
    });
  }

  ngOnInit(): void {
    this.planStore.refreshUsage();
  }

  /** Arranca la prueba: al checkout del plan (ahí se ingresa la tarjeta y Stripe
   *  aplica los 7 días gratis en la primera suscripción). */
  protected startTrial(planId: 'pro' | 'avanzado'): void {
    this.router.navigate(['/admin/plans/checkout', planId], {
      queryParams: { period: this.period },
    });
  }

  /** Omitir: seguir con el plan gratuito → al admin. */
  protected continueFree(): void {
    this.router.navigate(['/admin']);
  }
}
