import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  findCountryByCode,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { IconComponent } from '@ui';
import {
  BillingPeriod,
  CATALOG_ADDON_PRICE,
  CheckoutRequest,
  convertUsdToLocal,
  CURRENCY_SYMBOLS,
  PaymentCurrency,
  Plan,
  PLAN_BASE_PRICES,
  PromotionCodeValidation,
  resolveCheckoutCurrency,
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
        '∞ productos (ilimitados)',
        'Todo lo del Plan Básico',
        'Vinculación de dominio personalizado (el dominio se adquiere por separado)',
        'Código QR descargable',
        'Compartir por WhatsApp',
      ],
    },
    {
      title: 'Equipo',
      items: ['Hasta 10 miembros de equipo', 'Permisos por módulo'],
    },
    {
      title: 'Analíticas',
      items: [
        'Analíticas avanzadas',
        'Visitas al catálogo',
        'Hasta 30 reportes por mes',
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
  imports: [IconComponent, DecimalPipe, FormsModule],
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
  private readonly tenantCurrency = inject(TenantCurrencyStore);
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

  /** Coupon UI state. The user types the code, hits "Aplicar", we validate
   *  against Stripe via `validate-promotion-code` edge function, then store
   *  the resolved promo so the totals recalc and the Pay button forwards it
   *  to `create-checkout-session`. */
  public readonly couponInput      = signal('');
  public readonly appliedCoupon    = signal<PromotionCodeValidation | null>(null);
  public readonly couponError      = signal<string | null>(null);
  public readonly isApplyingCoupon = signal(false);

  /** Datos del referido pendiente del tenant, si entró por programa de
   *  Afiliados. El descuento se aplica automáticamente al total — tanto en
   *  el flujo Stripe (vía create-checkout-session) como en el de Pago Móvil
   *  (cálculo local + leyenda en el mensaje de WhatsApp). */
  public readonly referralInfo = signal<{
    referrerSlug: string | null;
    referrerName: string | null;
    discountPct: number;
  } | null>(null);

  /** Crédito de referidos acumulado por este tenant (siendo referrer).
   *  Si > 0 se ofrece la opción de aplicarlo en este pago — flujo Pago Móvil
   *  por ahora; en Stripe se aplica vía dashboard interno al confirmar. */
  public readonly availableCreditUsd = signal<number>(0);
  public readonly useReferralCredit = signal<boolean>(false);

  // Currency Stripe will actually charge in. Drives the on-screen totals +
  // the `currency` sent to the checkout edge function. VE → USD always.
  public readonly chargeCurrency = computed<PaymentCurrency>(() => {
    const code = this.tenantCurrency.countryCode();
    const country = findCountryByCode(code);
    return resolveCheckoutCurrency(code, country?.defaultCurrency);
  });

  public readonly currencySymbol = computed(
    () => CURRENCY_SYMBOLS[this.chargeCurrency()] ?? '$'
  );

  public readonly currencyCode = computed(
    () => this.chargeCurrency().toUpperCase()
  );

  public readonly isZeroDecimalCurrency = computed(() => {
    const c = this.chargeCurrency();
    return c === 'clp' || c === 'pyg';
  });

  public readonly plan = computed<Plan | null>(
    () => this.planStore.plans().find((p) => p.id === this.planId()) ?? null
  );

  public readonly planSections = computed<FeatureSection[]>(
    () => CHECKOUT_FEATURES[this.planId()] ?? []
  );

  public readonly maxProductsLabel = computed(() => {
    const plan = this.plan();
    if (!plan) return '';
    if (plan.maxProducts <= 0) return '∞ productos';
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

  /** Renovación: el tenant ya tiene ESTE mismo plan con una suscripción de
   *  Stripe. El checkout cobra el plan completo y el webhook cancela la
   *  suscripción anterior (previous_subscription_id). Sirve para mostrar copy
   *  de "renovación" en vez de "compra". */
  public readonly isRenewal = computed(() => {
    const current = this.planStore.currentPlan();
    const hasStripe = this.planStore.tenantPlanUsage()?.hasStripeSubscription ?? false;
    return hasStripe && !!current && !current.isFree && current.id === this.planId();
  });

  public readonly currentPlanPrice = computed(() => {
    const current = this.planStore.currentPlan();
    if (!current) return 0;
    return PLAN_BASE_PRICES[current.id] ?? 0;
  });

  private readonly monthlyBasePriceUsd = computed(() => {
    const targetPrice = PLAN_BASE_PRICES[this.planId()] ?? 0;
    if (this.isUpgrade()) {
      return Math.round((targetPrice - this.currentPlanPrice()) * 100) / 100;
    }
    return targetPrice;
  });

  public readonly baseCost = computed(() => {
    const { months } = BILLING_CONFIG[this.billingPeriod()];
    return convertUsdToLocal(this.monthlyBasePriceUsd() * months, this.chargeCurrency());
  });

  public readonly discountAmount = computed(() => {
    const { months, discount } = BILLING_CONFIG[this.billingPeriod()];
    return convertUsdToLocal(this.monthlyBasePriceUsd() * months * discount, this.chargeCurrency());
  });

  public readonly catalogAddonDisplayCost = computed(() => {
    const { months } = BILLING_CONFIG[this.billingPeriod()];
    return convertUsdToLocal(CATALOG_ADDON_PRICE * months, this.chargeCurrency());
  });

  public readonly catalogAddonCost = computed(() =>
    convertUsdToLocal(
      CATALOG_ADDON_PRICE *
        BILLING_CONFIG[this.billingPeriod()].months *
        this.catalogAddonQuantity(),
      this.chargeCurrency()
    )
  );

  /** Subtotal in USD before applying the coupon (plan + addon, with the
   *  billing-period discount baked in). Used as the base for both the visual
   *  coupon-discount line and the final totals. */
  private readonly preCouponTotalUsd = computed(() => {
    const { months, discount } = BILLING_CONFIG[this.billingPeriod()];
    const baseUsd = this.monthlyBasePriceUsd() * months * (1 - discount);
    const addonUsd =
      CATALOG_ADDON_PRICE * months * this.catalogAddonQuantity();
    return baseUsd + addonUsd;
  });

  /** Descuento del programa de referidos (USD), aplicado sobre el subtotal
   *  pre-cupón. Solo aplica si el tenant tiene un referral pending. */
  private readonly referralDiscountUsd = computed(() => {
    const info = this.referralInfo();
    if (!info) return 0;
    return this.preCouponTotalUsd() * (info.discountPct / 100);
  });

  public readonly referralDiscountAmount = computed(() =>
    convertUsdToLocal(this.referralDiscountUsd(), this.chargeCurrency())
  );

  /** Discount the applied coupon contributes (USD). `amount_off` from Stripe
   *  comes in minor units (cents). */
  private readonly couponDiscountUsd = computed(() => {
    const coupon = this.appliedCoupon();
    if (!coupon) return 0;
    if (coupon.percentOff != null) {
      return this.preCouponTotalUsd() * (coupon.percentOff / 100);
    }
    if (coupon.amountOff != null) {
      // Stripe `amount_off` is in the coupon's currency in minor units. We
      // only have a USD pipeline here, so we treat amount-off coupons as USD.
      return coupon.amountOff / 100;
    }
    return 0;
  });

  public readonly couponDiscountAmount = computed(() =>
    convertUsdToLocal(this.couponDiscountUsd(), this.chargeCurrency())
  );

  /** Crédito a consumir en este pago (capado al saldo disponible + al monto
   *  restante luego de los descuentos por cupón y referido). */
  public readonly creditUsedUsd = computed(() => {
    if (!this.useReferralCredit()) return 0;
    const remainingAfterDiscounts = Math.max(
      0,
      this.preCouponTotalUsd() - this.couponDiscountUsd() - this.referralDiscountUsd()
    );
    return Math.min(this.availableCreditUsd(), remainingAfterDiscounts);
  });

  public readonly creditUsedAmount = computed(() =>
    convertUsdToLocal(this.creditUsedUsd(), this.chargeCurrency())
  );

  public readonly couponDiscountPercent = computed(
    () => this.appliedCoupon()?.percentOff ?? null
  );

  // Total the user will be charged, in the charge currency.
  public readonly total = computed(() => {
    const final = Math.max(
      0,
      this.preCouponTotalUsd() - this.couponDiscountUsd() - this.referralDiscountUsd() - this.creditUsedUsd()
    );
    return convertUsdToLocal(final, this.chargeCurrency());
  });

  // Pure USD total — used for the Venezuela Bs. approximation line and the
  // WhatsApp message (Pago Móvil is a VE-only flow, priced in USD + BCV).
  public readonly totalUsd = computed(() => {
    const final = Math.max(
      0,
      this.preCouponTotalUsd() - this.couponDiscountUsd() - this.referralDiscountUsd() - this.creditUsedUsd()
    );
    return Math.round(final * 100) / 100;
  });

  public readonly totalVes = computed(() => {
    const rate = this.bcvUsdRate();
    if (!rate) return null;
    return Math.round(this.totalUsd() * rate);
  });

  public readonly isVenezuela = computed(() => this.tenantCurrency.isVenezuela());

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

  async ngOnInit(): Promise<void> {
    const planId = this.route.snapshot.paramMap.get('planId') ?? '';
    const period = (this.route.snapshot.queryParamMap.get('period') as BillingPeriod) ?? 'monthly';

    // Solo los planes con precio tienen checkout self-service (cubre
    // 'gratis' y 'enterprise', que se contrata vía ventas).
    if (!PLAN_BASE_PRICES[planId]) {
      this.router.navigate(['/admin/plans']);
      return;
    }

    this.planId.set(planId);
    this.billingPeriod.set(period);

    this.planStore.loadPlans();
    this.planStore.loadTenantPlanUsage();
    this.loadBcvRate();
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (tenantId) {
      this.tenantCurrency.load(tenantId);
      this.loadReferralInfo(tenantId);
      this.loadAvailableCredit(tenantId);
    }
  }

  /** Carga el crédito de referidos acumulado por este tenant (siendo referrer
   *  de otros que pagaron). Si tiene > 0 mostramos la opción de aplicarlo. */
  private async loadAvailableCredit(tenantId: number): Promise<void> {
    const { data } = await this.supabase
      .from('tenants')
      .select('referral_credit_usd')
      .eq('id', tenantId)
      .maybeSingle();

    if (data?.referral_credit_usd != null) {
      this.availableCreditUsd.set(Number(data.referral_credit_usd));
    }
  }

  /** Si el tenant entró por programa de Afiliados y tiene un referral pending,
   *  cargar los datos para mostrar y aplicar el descuento. RLS permite al
   *  owner leer su propia fila en `referrals`. */
  private async loadReferralInfo(tenantId: number): Promise<void> {
    const { data } = await this.supabase
      .from('referrals')
      .select('referrer_tenant_id, status')
      .eq('referred_tenant_id', tenantId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!data) return;

    const [referrerResp, configResp] = await Promise.all([
      this.supabase
        .from('tenants')
        .select('slug, name')
        .eq('id', data.referrer_tenant_id)
        .maybeSingle(),
      this.supabase
        .from('referral_config')
        .select('referred_discount_pct')
        .eq('id', 1)
        .maybeSingle(),
    ]);

    this.referralInfo.set({
      referrerSlug: referrerResp.data?.slug ?? null,
      referrerName: referrerResp.data?.name ?? null,
      discountPct: (configResp.data?.referred_discount_pct as number | undefined) ?? 20,
    });
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

  public async applyCoupon(): Promise<void> {
    const code = this.couponInput().trim();
    if (!code || this.isApplyingCoupon()) return;

    this.isApplyingCoupon.set(true);
    this.couponError.set(null);

    // 1) Si todavía no tenemos referral aplicado, probar como código de
    //    referido. register_referral devuelve `registered` la primera vez
    //    o `already_registered` si ya estaba seteado en signup.
    if (!this.referralInfo()) {
      const tenantId = await this.tenantStore.getTenantIdAsync();
      if (tenantId) {
        const { data: refData, error: refError } = await this.supabase.rpc(
          'register_referral',
          { p_code: code, p_referred_tenant_id: tenantId }
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const status = (refData as any)?.status as string | undefined;

        if (!refError && (status === 'registered' || status === 'already_registered')) {
          await this.loadReferralInfo(tenantId);
          this.couponInput.set('');
          this.isApplyingCoupon.set(false);
          return;
        }
        if (status === 'self_referral_email' || status === 'self_referral_tenant') {
          this.couponError.set('No podés usar tu propio código de referido.');
          this.isApplyingCoupon.set(false);
          return;
        }
        if (status === 'disposable_email') {
          this.couponError.set('Tu email no califica para el programa de referidos.');
          this.isApplyingCoupon.set(false);
          return;
        }
        // status === 'invalid_code' o 'no_code' → caemos al Stripe promo.
      }
    }

    // 2) Validar como Stripe promotion_code (cupón clásico).
    const result = await this.checkoutService.validatePromotionCode(code, this.planId());

    result
      .mapRight((promo) => {
        this.appliedCoupon.set(promo);
        this.couponInput.set(promo.code);
      })
      .mapLeft((err) => {
        this.appliedCoupon.set(null);
        this.couponError.set(err.message);
      });

    this.isApplyingCoupon.set(false);
  }

  public removeCoupon(): void {
    this.appliedCoupon.set(null);
    this.couponInput.set('');
    this.couponError.set(null);
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
    const totalUsd  = this.totalUsd();
    const totalBs   = this.totalVes();
    const slug      = localStorage.getItem('slug') ?? '';
    const catalogs  = this.catalogAddonQuantity();

    const tenantSlug = this.tenantStore.tenantSlug() ?? slug;

    const referral = this.referralInfo();

    let msg = `Hola! Quiero adquirir el *${planName}* en CatalogoHoy\n\n`;
    msg += `- *Plan:* ${planName}\n`;
    msg += `- *Periodo:* ${periodStr}\n`;
    if (catalogs > 0) {
      msg += `- *Catálogos adicionales:* ${catalogs}\n`;
    }
    if (referral) {
      const refLabel = referral.referrerName ?? referral.referrerSlug ?? '-';
      msg += `- *🎁 Código referido aplicado:* ${refLabel} (-${referral.discountPct}% descuento)\n`;
    }
    const credit = this.creditUsedUsd();
    if (credit > 0) {
      msg += `- *💰 Crédito de referidos a consumir:* $${credit.toFixed(2)} USD\n`;
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
      currency:             this.chargeCurrency(),
      promotionCode:        this.appliedCoupon()?.code,
    };

    const result = await this.checkoutService.createCheckoutSession(request);

    result
      .mapRight(({ url }) => {
        this.metaPixel.trackEvent('InitiateCheckout', {
          content_name: this.planId(),
          currency: this.currencyCode(),
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
