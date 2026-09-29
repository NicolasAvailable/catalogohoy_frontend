import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  BillingPeriod,
  CheckoutService,
  PlanStore,
  resolveCheckoutCurrency,
} from '@catalogohoy/plan';
import { findCountryByCode, TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
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
 * usuario cae en `/bienvenida` (el signup redirige acá; el login sigue a
 * `/admin`). "Probar Pro/Avanzado" crea la sesión de Stripe (con el trial de 7
 * días que la edge function aplica sola) y redirige DIRECTO al checkout de
 * Stripe para poner la tarjeta — sin pasar por la pantalla de checkout interna.
 * "Continuar con el plan gratuito" sigue al admin en plan Gratis.
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
  private readonly checkout = inject(CheckoutService);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);

  private readonly period: BillingPeriod = 'monthly';

  /** Plan cuya sesión de Stripe se está creando (deshabilita los botones). */
  public readonly loadingPlan = signal<string | null>(null);
  public readonly error = signal<string | null>(null);

  public readonly plans: TrialPlan[] = [
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
    // La moneda del checkout se resuelve por el país del tenant; la precargamos
    // para armar la sesión en la moneda correcta al tocar "Probar".
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (tid) this.tenantCurrency.load(tid);
    });
  }

  /** Crea la sesión de Stripe (con trial) y redirige DIRECTO a Stripe para
   *  poner la tarjeta. La edge function aplica `trial_period_days` sola. */
  public async startTrial(planId: 'pro' | 'avanzado'): Promise<void> {
    if (this.loadingPlan()) return;
    this.loadingPlan.set(planId);
    this.error.set(null);

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.error.set('No se pudo obtener la información de tu negocio.');
      this.loadingPlan.set(null);
      return;
    }

    const code = this.tenantCurrency.countryCode();
    const currency = resolveCheckoutCurrency(code, findCountryByCode(code)?.defaultCurrency);
    const origin = window.location.origin;
    const slug = localStorage.getItem('slug') ?? this.tenantStore.tenantSlug() ?? '';

    const result = await this.checkout.createCheckoutSession({
      planId,
      billingPeriod: this.period,
      tenantId,
      successUrl: `${origin}/admin/plans/success?slug=${slug}`,
      cancelUrl: `${origin}/bienvenida`,
      currency,
    });

    result
      .mapRight(({ url }) => {
        window.location.href = url;
      })
      .mapLeft((err) => {
        this.error.set(err.message);
        this.loadingPlan.set(null);
      });
  }

  /** Omitir: seguir con el plan gratuito → al admin. */
  public continueFree(): void {
    if (this.loadingPlan()) return;
    this.router.navigate(['/admin']);
  }
}
