import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IconComponent } from '@ui';
import {
  BillingPeriod,
  CATALOG_ADDON_PRICE,
  CheckoutRequest,
  PLAN_BASE_PRICES,
  Plan,
} from '../../domain';
import { CheckoutService, PlanStore } from '../../infrastructure';
import { MetaPixelService, SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';

type FeatureSection = {
  title: string;
  items: string[];
};

const BILLING_CONFIG: Record<
  BillingPeriod,
  { label: string; months: number; discount: number }
> = {
  monthly:   { label: 'mes',       months: 1,  discount: 0    },
  quarterly: { label: 'trimestre', months: 3,  discount: 0.10 },
  annual:    { label: 'año',       months: 12, discount: 0.15 },
};

const CHECKOUT_FEATURES: Record<string, FeatureSection[]> = {
  basico: [
    {
      title: 'Tu catálogo',
      items: [
        '1 catálogo digital',
        'Hasta 100 productos',
        'Diseño personalizable',
        'Código QR descargable',
        'Compartir por WhatsApp',
        'Todos los módulos disponibles',
      ],
    },
    {
      title: 'Equipo',
      items: ['1 miembro de equipo', 'Permisos por módulo'],
    },
    {
      title: 'Analíticas',
      items: ['Visitas al catálogo', 'Analíticas en tiempo real'],
    },
    {
      title: 'Soporte',
      items: ['Soporte prioritario', 'Actualizaciones incluidas'],
    },
  ],
  avanzado: [
    {
      title: 'Tu catálogo',
      items: [
        '1 catálogo digital',
        'Hasta 500 productos',
        'Todo lo del Plan Básico',
        'Dominio personalizado',
        'Código QR descargable',
        'Compartir por WhatsApp',
      ],
    },
    {
      title: 'Equipo',
      items: ['Hasta 5 miembros de equipo', 'Permisos por módulo'],
    },
    {
      title: 'Analíticas',
      items: [
        'Analíticas avanzadas',
        'Visitas al catálogo',
        'Reportes detallados',
      ],
    },
    {
      title: 'Soporte',
      items: ['Soporte dedicado 24/7', 'Actualizaciones incluidas'],
    },
  ],
};

const WHATSAPP_NUMBER = '584220240947';

@Component({
  selector: 'lib-plan-checkout',
  imports: [IconComponent, DecimalPipe],
  templateUrl: './plan-checkout.html',
  styleUrl: './plan-checkout.css',
  host: { class: 'flex-1 flex flex-col min-h-0' },
})
export class PlanCheckout implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly planStore = inject(PlanStore);
  private readonly checkoutService = inject(CheckoutService);
  private readonly tenantStore = inject(TenantStore);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly supabase = SupabaseClientProvider.getInstance();

  public readonly billingOptions: { key: BillingPeriod; label: string; savingsLabel?: string }[] = [
    { key: 'monthly',   label: 'Mensual' },
    { key: 'quarterly', label: 'Trimestral', savingsLabel: '10% off' },
    { key: 'annual',    label: 'Anual',      savingsLabel: '15% off' },
  ];

  public readonly planId               = signal<string>('');
  public readonly billingPeriod        = signal<BillingPeriod>('monthly');
  public readonly paymentMethod        = signal<'card' | 'mobile'>('card');
  public readonly isLoading            = signal(false);
  public readonly termsAccepted        = signal(false);
  public readonly catalogAddonQuantity = signal(0);
  public readonly error                = signal<string | null>(null);

  /** Tasa BCV USD (directo de bcv_rates, independiente del módulo "Tasas del día") */
  public readonly bcvUsdRate = signal<number | null>(null);
  public readonly isFetchingRate = signal(false);

  public readonly plan = computed<Plan | null>(
    () => this.planStore.plans().find((p) => p.id === this.planId()) ?? null
  );

  public readonly planSections = computed<FeatureSection[]>(
    () => CHECKOUT_FEATURES[this.planId()] ?? []
  );

  public readonly maxProductsLabel = computed(() => {
    const plan = this.plan();
    if (!plan) return '';
    return `Hasta ${plan.maxProducts} productos`;
  });

  public readonly isUpgrade = computed(() => {
    const current = this.planStore.currentPlan();
    if (!current || current.isFree) return false;
    const currentPrice = PLAN_BASE_PRICES[current.id] ?? 0;
    const targetPrice = PLAN_BASE_PRICES[this.planId()] ?? 0;
    return currentPrice > 0 && targetPrice > currentPrice;
  });

  public readonly currentPlanName = computed(
    () => this.planStore.currentPlan()?.name ?? ''
  );

  public readonly currentPlanPrice = computed(() => {
    const current = this.planStore.currentPlan();
    if (!current) return 0;
    return PLAN_BASE_PRICES[current.id] ?? 0;
  });

  private readonly monthlyBasePrice = computed(() => {
    const targetPrice = PLAN_BASE_PRICES[this.planId()] ?? 0;
    if (this.isUpgrade()) {
      return Math.round((targetPrice - this.currentPlanPrice()) * 100) / 100;
    }
    return targetPrice;
  });

  public readonly baseCost = computed(() => {
    const { months } = BILLING_CONFIG[this.billingPeriod()];
    return Math.round(this.monthlyBasePrice() * months * 100) / 100;
  });

  public readonly discountAmount = computed(() => {
    const { months, discount } = BILLING_CONFIG[this.billingPeriod()];
    return Math.round(this.monthlyBasePrice() * months * discount * 100) / 100;
  });

  public readonly catalogAddonDisplayCost = computed(() => {
    const { months } = BILLING_CONFIG[this.billingPeriod()];
    const addonPrice = CATALOG_ADDON_PRICE;
    return Math.round(addonPrice * months * 100) / 100;
  });

  public readonly catalogAddonCost = computed(
    () => Math.round(this.catalogAddonDisplayCost() * this.catalogAddonQuantity() * 100) / 100
  );

  public readonly total = computed(
    () =>
      Math.round(
        (this.baseCost() - this.discountAmount() + this.catalogAddonCost()) * 100
      ) / 100
  );

  public readonly totalVes = computed(() => {
    const rate = this.bcvUsdRate();
    if (!rate) return null;
    return Math.round(this.total() * rate);
  });

  public readonly monthsLabel = computed(() => {
    const { months } = BILLING_CONFIG[this.billingPeriod()];
    if (months === 1)  return '1 mes';
    if (months === 3)  return '3 meses';
    return '12 meses';
  });

  public readonly periodLabel = computed(() => {
    const period = this.billingPeriod();
    if (period === 'monthly')   return 'mes';
    if (period === 'quarterly') return 'trimestre';
    return 'año';
  });

  public readonly discountPercent = computed(
    () => BILLING_CONFIG[this.billingPeriod()].discount * 100
  );

  ngOnInit(): void {
    const planId = this.route.snapshot.paramMap.get('planId') ?? '';
    const period = (this.route.snapshot.queryParamMap.get('period') as BillingPeriod) ?? 'monthly';

    this.planId.set(planId);
    this.billingPeriod.set(period);

    this.planStore.loadPlans();
    this.planStore.loadTenantPlanUsage();
    this.loadBcvRate();
  }

  private async loadBcvRate(): Promise<void> {
    this.isFetchingRate.set(true);
    const { data } = await this.supabase
      .from('bcv_rates')
      .select('usd')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.usd) {
      this.bcvUsdRate.set(data.usd);
    }
    this.isFetchingRate.set(false);
  }

  public toggleTerms(): void {
    this.termsAccepted.set(!this.termsAccepted());
  }

  public payMobile(): void {
    if (!this.termsAccepted()) return;

    const plan        = this.plan();
    const planName    = plan ? `Plan ${plan.name}` : 'Plan';
    const periodNames: Record<BillingPeriod, string> = {
      monthly:   'Mensual',
      quarterly: 'Trimestral',
      annual:    'Anual',
    };
    const periodStr = periodNames[this.billingPeriod()];
    const totalUsd  = this.total();
    const totalBs   = this.totalVes();
    const slug      = localStorage.getItem('slug') ?? '';
    const catalogs  = this.catalogAddonQuantity();

    const tenantSlug = this.tenantStore.tenantSlug() ?? slug;

    let msg = `Hola! Quiero adquirir el *${planName}* en CatálogoHoy\n\n`;
    msg += `- *Plan:* ${planName}\n`;
    msg += `- *Periodo:* ${periodStr}\n`;
    if (catalogs > 0) {
      msg += `- *Catálogos adicionales:* ${catalogs}\n`;
    }
    msg += `- *Total:* $${totalUsd} USD`;
    if (totalBs) {
      msg += ` (= Bs. ${totalBs.toLocaleString('es-VE')})`;
    }
    msg += `\n- *Negocio:* ${tenantSlug}`;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    this.metaPixel.trackEvent('InitiateCheckout', {
      content_name: this.planId(),
      currency: 'VES',
      value: totalUsd,
    });
    window.open(url, '_blank');
  }

  public async pay(): Promise<void> {
    if (!this.termsAccepted() || this.isLoading()) return;

    if (this.paymentMethod() === 'mobile') {
      this.payMobile();
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.error.set('No se pudo obtener información del negocio.');
      this.isLoading.set(false);
      return;
    }

    const origin = window.location.origin;
    const slug   = localStorage.getItem('slug') ?? '';
    const request: CheckoutRequest = {
      planId:               this.planId(),
      billingPeriod:        this.billingPeriod(),
      tenantId,
      successUrl:  `${origin}/admin/plans/success?slug=${slug}`,
      cancelUrl:   `${origin}/admin/plans/checkout/${this.planId()}?period=${this.billingPeriod()}&slug=${slug}`,
      catalogAddonQuantity: this.catalogAddonQuantity(),
    };

    const result = await this.checkoutService.createCheckoutSession(request);

    result
      .mapRight(({ url }) => {
        this.metaPixel.trackEvent('InitiateCheckout', {
          content_name: this.planId(),
          currency: 'USD',
          value: this.total(),
        });
        window.location.href = url;
      })
      .mapLeft((err) => {
        this.error.set(err.message);
        this.isLoading.set(false);
      });
  }

  public cancel(): void {
    this.router.navigate(['/admin/plans']);
  }
}
