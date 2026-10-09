// ═══════════════════════════════════════════════════════════════════════════
// create-checkout-session — checkout de planes vía Stripe.
//
// ⚠️ El PRICE_MAP de abajo es LA FUENTE DE VERDAD de lo que se cobra (las
// columnas stripe_price_id_* de la tabla plans son informativas y estuvieron
// desactualizadas). Cambios de precio = actualizar este map + PLAN_BASE_PRICES
// en la app + deployarlos juntos.
//
// SWITCH pricing 2026-07 (CAT-35): antes de deployar esta versión, rellenar
// los __PRICE_*__ con los IDs creados en Stripe (CAT-33). Deployar junto con
// la migración 20260721_plan_pro_pricing_switch.sql y el commit de la app
// "avanzado a 29.99". Los precios viejos de avanzado (que quedan anclados a
// las suscripciones grandfathered) eran:
//   monthly  price_1TGfmg85rys2QLXduNXYy9h3
//   quarterly price_1TGfmh85rys2QLXdH8DRmSqH
//   annual   price_1TGfmh85rys2QLXdBW7wZB1U
//
// Versionado a partir de la v38 deployada.
// Switch 2026-07-28: precios NUEVOS (regen batch parallel-freemonth). Cambios:
//   - Anual = meses gratis por plan: Básico 1 mes (11/12), Pro y Avanzado 2
//     meses (10/12). Reemplaza el 25% off.
//   - ARS y BOB pasan a tasa PARALELA (1550 / 12.5) en todos los períodos.
//   - Anual ahora es multi-moneda (antes era USD-only).
// El quarterly sigue en 10% off. Precios viejos (25% off / tasas viejas) quedan
// inertes para las subs grandfathered (precio anclado en Stripe).
// ═══════════════════════════════════════════════════════════════════════════
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};

// Switch a decimales (2026-10-08): Pro $19.99 / Avanzado $34.99, precios nuevos
// en Stripe (live, batch pricing-decimals-2026-10) sobre los mismos productos
// (pro prod_UvXD7BXlWjSsUN, avanzado prod_U4NQhPd3F2XD85), multimoneda con los
// currency_options de CHECKOUT_FX_RATES. El quarterly queda inerte (ya no se
// ofrece). basico (11.99) vuelve a ofrecerse en altas nuevas con sus IDs de
// siempre. Los precios $20/$35 del switch 2026-09 quedan anclados a las subs
// que ya los pagan (monthly price_1UL59T.../price_1UL59m..., annual
// price_1UL59g.../price_1UL59r...).
const PRICE_MAP: Record<string, Record<string, string>> = {
  basico: {
    monthly:   "price_1UBcws85rys2QLXd2VNxshFD",
    quarterly: "price_1UBcwt85rys2QLXd9plZqrRK",
    annual:    "price_1UBcwt85rys2QLXdstJ7waFV", // $71.94 (-50% anual)
  },
  pro: {
    monthly:   "price_1UOJEz85rys2QLXdD2qy2sbm", // $19.99
    quarterly: "price_1TyBl585rys2QLXdKk3w7yGm",
    annual:    "price_1UOJFA85rys2QLXd5NgVNHLY", // $119.94 (-50% anual)
  },
  avanzado: {
    monthly:   "price_1UOJFK85rys2QLXdN1DNC5Uh", // $34.99
    quarterly: "price_1TyBl785rys2QLXdp7nbigVf",
    annual:    "price_1UOJFV85rys2QLXdkcOdcw0T", // $209.94 (-50% anual)
  },
};

const CATALOG_ADDON_PRICE_MAP: Record<string, string> = {
  monthly:   "price_1TpXhq85rys2QLXd4BJAH6kl",
  quarterly: "price_1TpXi985rys2QLXdcaQRPqrL",
  annual:    "price_1TpXia85rys2QLXd5OORzQS9",
};

const SUPPORTED_CURRENCIES = new Set([
  "usd", "eur", "ars", "bob", "brl", "cad", "clp", "cop", "crc", "dop",
  "gtq", "gyd", "htg", "hnl", "jmd", "mxn", "nio", "pen", "pyg", "uyu",
  "bsd", "bbd", "bzd", "srd", "ttd",
]);

function resolveCurrency(requested?: string): string {
  const lower = (requested || "usd").toLowerCase();
  return SUPPORTED_CURRENCIES.has(lower) ? lower : "usd";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { planId, billingPeriod, tenantId, successUrl, cancelUrl, catalogAddonQuantity, currency, promotionCode } = await req.json();

    if (!planId || !billingPeriod || !tenantId || !successUrl || !cancelUrl) {
      return new Response(JSON.stringify({ error: "Faltan parámetros requeridos" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const priceId = PRICE_MAP[planId]?.[billingPeriod];
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Plan o período inválido" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const addonQty = typeof catalogAddonQuantity === "number" && catalogAddonQuantity > 0
      ? catalogAddonQuantity
      : 0;

    const resolvedCurrency = resolveCurrency(currency);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const admin  = createClient(supabaseUrl, serviceKey);

    const { data: tenantRow } = await admin
      .from("tenants")
      .select("stripe_customer_id, stripe_subscription_id, referred_by_tenant_id, trial_used_at")
      .eq("id", tenantId)
      .single();

    let customerId: string = tenantRow?.stripe_customer_id ?? "";
    const previousSubscriptionId: string = tenantRow?.stripe_subscription_id ?? "";
    const referredByTenantId: number | null = tenantRow?.referred_by_tenant_id ?? null;

    // Free trial de 7 días: SOLO en la primera suscripción del tenant (nunca
    // tuvo sub de Stripe y no consumió su trial antes). El webhook estampa
    // `trial_used_at` cuando la sub con trial arranca, así que no se quema si
    // el usuario abandona el checkout. Con addons de catálogo no aplica trial
    // (se cobra el addon de una). El status `trialing` ya lo trata el webhook.
    // Solo Pro y Avanzado dan trial — el Básico se cobra de una (2026-10-08).
    const eligibleForTrial =
      !previousSubscriptionId && !tenantRow?.trial_used_at && addonQty === 0 && planId !== "basico";

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { tenant_id: String(tenantId), auth_user_id: user.id },
      });
      customerId = customer.id;
      await admin
        .from("tenants")
        .update({ stripe_customer_id: customerId })
        .eq("id", tenantId);
    }

    // Stripe FIJA la moneda de un customer con su primera factura/suscripción.
    // Si este customer ya tiene una moneda fijada (p. ej. una sub activa en USD),
    // el checkout DEBE usar esa misma moneda o Stripe rechaza con "You cannot
    // combine currencies on a single customer". Esto permite pagar/renovar o
    // hacer upgrade ANTICIPADO a quien ya tiene una suscripción, aunque su
    // catálogo esté en otra moneda (caso real: catálogo DOP/HTG con sub en USD).
    let checkoutCurrency = resolvedCurrency;
    try {
      const existingCustomer = await stripe.customers.retrieve(customerId);
      const lockedCurrency =
        existingCustomer && !(existingCustomer as Stripe.DeletedCustomer).deleted
          ? (existingCustomer as Stripe.Customer).currency
          : null;
      if (lockedCurrency) checkoutCurrency = lockedCurrency;
    } catch (_err) {
      // Si falla la lectura, seguimos con la moneda solicitada.
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: priceId, quantity: 1 },
    ];

    if (addonQty > 0) {
      const catalogAddonPriceId = CATALOG_ADDON_PRICE_MAP[billingPeriod];
      if (catalogAddonPriceId) {
        lineItems.push({ price: catalogAddonPriceId, quantity: addonQty });
      }
    }

    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    let allowPromotionCodes: boolean | undefined = true;
    let appliedPromoCodeForMeta = promotionCode ?? "";

    if (typeof promotionCode === "string" && promotionCode.trim()) {
      const promoCodes = await stripe.promotionCodes.list({
        code: promotionCode.trim(),
        active: true,
        limit: 1,
      });
      if (promoCodes.data.length === 0) {
        return new Response(JSON.stringify({ error: "Código promocional inválido" }), {
          status: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      discounts = [{ promotion_code: promoCodes.data[0].id }];
      allowPromotionCodes = undefined;
    }
    else if (referredByTenantId && !previousSubscriptionId) {
      try {
        const { data: referralRow } = await admin
          .from("referrals")
          .select("id, status")
          .eq("referred_tenant_id", tenantId)
          .eq("status", "pending")
          .maybeSingle();

        if (referralRow) {
          const { data: configRow } = await admin
            .from("referral_config")
            .select("referred_discount_pct")
            .eq("id", 1)
            .single();

          const discountPct = (configRow?.referred_discount_pct as number | undefined) ?? 20;

          const coupon = await stripe.coupons.create({
            percent_off: discountPct,
            duration: "once",
            name: `Referral ${discountPct}% off`,
            metadata: {
              tenant_id: String(tenantId),
              referral_id: String(referralRow.id),
              source: "affiliate_program",
            },
          });

          const stamp = Date.now().toString(36).toUpperCase();
          const promoCode = await stripe.promotionCodes.create({
            coupon: coupon.id,
            code: `REF-${stamp}`,
            max_redemptions: 1,
            metadata: {
              tenant_id: String(tenantId),
              referral_id: String(referralRow.id),
            },
          });

          discounts = [{ promotion_code: promoCode.id }];
          allowPromotionCodes = undefined;
          appliedPromoCodeForMeta = promoCode.code;

          await admin
            .from("referrals")
            .update({ referred_stripe_coupon_id: coupon.id })
            .eq("id", referralRow.id);
        }
      } catch (err) {
        console.warn("referral discount failed:", (err as Error).message);
      }
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: "subscription",
      currency: checkoutCurrency,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url:  cancelUrl,
      metadata: {
        tenant_id:                String(tenantId),
        plan_id:                  planId,
        previous_subscription_id: previousSubscriptionId,
        catalog_addon_quantity:   String(addonQty),
        currency:                 checkoutCurrency,
        promotion_code:           appliedPromoCodeForMeta,
      },
      subscription_data: {
        metadata: { tenant_id: String(tenantId), plan_id: planId },
        ...(eligibleForTrial ? { trial_period_days: 7 } : {}),
      },
    };
    if (discounts) sessionParams.discounts = discounts;
    else sessionParams.allow_promotion_codes = allowPromotionCodes;

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url, currency: checkoutCurrency }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
