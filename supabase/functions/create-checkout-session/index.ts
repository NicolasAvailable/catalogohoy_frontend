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
// Versionado a partir de la v38 deployada. Cambios respecto a esa versión:
// solo el PRICE_MAP — pro agregado, avanzado a $29.99 y el ANUAL con 25% off
// (precios nuevos price_1Twl8*, creados 2026-07; antes era 15% off). El
// quarterly sigue en 10%.
// ═══════════════════════════════════════════════════════════════════════════
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};

const PRICE_MAP: Record<string, Record<string, string>> = {
  basico: {
    monthly:   "price_1TGfmg85rys2QLXdofh9ytbw",
    quarterly: "price_1TGfmg85rys2QLXdjyfHoGWn",
    annual:    "price_1Twl8B85rys2QLXdPxrTsKgi",
  },
  pro: {
    monthly:   "price_1Tvg9h85rys2QLXd18YBSdOk",
    quarterly: "price_1Tvg9u85rys2QLXdaDdgvbii",
    annual:    "price_1Twl8D85rys2QLXdriJD6mKz",
  },
  avanzado: {
    monthly:   "price_1TvgAE85rys2QLXdoNMJFJ6O",
    quarterly: "price_1TvgAO85rys2QLXdfdTCu165",
    annual:    "price_1Twl8E85rys2QLXdOAhiu0kx",
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
      .select("stripe_customer_id, stripe_subscription_id, referred_by_tenant_id")
      .eq("id", tenantId)
      .single();

    let customerId: string = tenantRow?.stripe_customer_id ?? "";
    const previousSubscriptionId: string = tenantRow?.stripe_subscription_id ?? "";
    const referredByTenantId: number | null = tenantRow?.referred_by_tenant_id ?? null;

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
      currency: resolvedCurrency,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url:  cancelUrl,
      metadata: {
        tenant_id:                String(tenantId),
        plan_id:                  planId,
        previous_subscription_id: previousSubscriptionId,
        catalog_addon_quantity:   String(addonQty),
        currency:                 resolvedCurrency,
        promotion_code:           appliedPromoCodeForMeta,
      },
      subscription_data: {
        metadata: { tenant_id: String(tenantId), plan_id: planId },
      },
    };
    if (discounts) sessionParams.discounts = discounts;
    else sessionParams.allow_promotion_codes = allowPromotionCodes;

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url, currency: resolvedCurrency }), {
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
