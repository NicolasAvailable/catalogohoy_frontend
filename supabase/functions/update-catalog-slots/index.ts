// ═══════════════════════════════════════════════════════════════════════════
// update-catalog-slots — compra de catálogos adicionales sobre la suscripción
// activa (agrega/actualiza el ítem de addon y cobra la parte prorrateada YA).
//
// Versionado en el repo a partir de la v46 deployada (2026-11-10). Fixes:
//  - El período del addon salía de una lista de price IDs de 2026-03 (gen 1 /
//    1.5). Con los precios actuales caía siempre a "monthly", y a una sub ANUAL
//    le agregaba el addon MENSUAL → Stripe rechaza (intervalos distintos) → 500
//    y el front mostraba "Edge Function returned a non-2xx status code".
//    Ahora el período sale del `recurring` del precio del plan en la sub.
//  - `payment_behavior: "error_if_incomplete"`: si el cobro falla o pide 3DS no
//    se agrega el catálogo (antes quedaba sumado aunque el pago fallara).
//  - Solo owner/admin del tenant (antes cualquier usuario logueado podía
//    agregar catálogos, y cobrarlos, a la sub de otro tenant).
//  - Errores con mensaje claro en `error` (el front lo muestra tal cual).
// ═══════════════════════════════════════════════════════════════════════════
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};

// Addon vigente ($4.99/mes) por período. Mismo map que create-checkout-session.
const CATALOG_ADDON_PRICE_MAP: Record<string, string> = {
  monthly:   "price_1TpXhq85rys2QLXd4BJAH6kl",
  quarterly: "price_1TpXi985rys2QLXdcaQRPqrL",
  annual:    "price_1TpXia85rys2QLXd5OORzQS9",
};

// Addons viejos ($5.99 / $3.99) que siguen en subs existentes: si la sub ya
// tiene uno, se le sube la cantidad (mantiene su precio) en vez de duplicar.
const LEGACY_ADDON_PRICE_IDS = [
  "price_1T6FOP85rys2QLXdBCv2bKYj",
  "price_1T6FeL85rys2QLXdTynF6gvl",
  "price_1T6FeM85rys2QLXd0oiLc2jh",
  "price_1TSKFj85rys2QLXdjTw0rzPf",
  "price_1TSKFj85rys2QLXdWKigiMHd",
  "price_1TSKFj85rys2QLXdAo6dtEpx",
];

const CATALOG_ADDON_PRICE_SET = new Set([
  ...Object.values(CATALOG_ADDON_PRICE_MAP),
  ...LEGACY_ADDON_PRICE_IDS,
]);

const FN = "update-catalog-slots";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function logDebug(admin: any, message: string) {
  await admin.from("_debug_logs").insert({ fn_name: FN, message });
}

/** Período de facturación según el `recurring` del precio (no por lista de IDs). */
function periodOf(price: Stripe.Price | null | undefined): string {
  const rec = price?.recurring;
  if (!rec) return "monthly";
  if (rec.interval === "year") return "annual";
  if (rec.interval === "month" && rec.interval_count === 3) return "quarterly";
  return "monthly";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

    const { tenantId, additionalQuantity } = await req.json();
    await logDebug(admin, `Request: tenantId=${tenantId}, qty=${additionalQuantity}, user=${user.id}`);

    if (!tenantId || typeof additionalQuantity !== "number" || additionalQuantity < 1 || additionalQuantity > 20) {
      return json({ success: false, error: "Cantidad de catálogos inválida" }, 400);
    }

    // Solo owner/admin del tenant: esto cobra la tarjeta guardada off-session.
    const { data: internalUser } = await admin
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const internalUserId = (internalUser as { id?: number } | null)?.id ?? null;
    const { data: membership } = internalUserId === null
      ? { data: null }
      : await admin
          .from("users_tenants")
          .select("role")
          .eq("tenant_id", Number(tenantId))
          .eq("user_id", internalUserId)
          .in("role", ["owner", "admin"])
          .maybeSingle();
    if (!membership) return json({ success: false, error: "Solo el dueño de la tienda puede comprar catálogos." }, 403);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

    const { data: tenantRow, error: tenantErr } = await admin
      .from("tenants")
      .select("stripe_subscription_id, extra_catalogs")
      .eq("id", Number(tenantId))
      .single();

    if (tenantErr || !tenantRow?.stripe_subscription_id) {
      await logDebug(admin, `Tenant error: ${tenantErr?.message ?? "No subscription"}`);
      return json({ success: false, error: "Necesitas un plan activo pagado con tarjeta para comprar catálogos." }, 400);
    }

    const subscriptionId = tenantRow.stripe_subscription_id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await logDebug(admin, `Sub ${subscriptionId} status: ${subscription.status}, items: ${subscription.items.data.length}`);

    if (subscription.status !== "active" && subscription.status !== "trialing") {
      return json({ success: false, error: "Tu suscripción no está activa. Revisa tu método de pago en Planes." }, 400);
    }

    const planItem = subscription.items.data.find((item) => !CATALOG_ADDON_PRICE_SET.has(item.price.id));
    const billingPeriod = periodOf(planItem?.price);
    const catalogAddonPriceId = CATALOG_ADDON_PRICE_MAP[billingPeriod];
    await logDebug(admin, `Plan price: ${planItem?.price.id ?? "-"} → period ${billingPeriod}`);

    const existingAddonItem = subscription.items.data.find((item) => CATALOG_ADDON_PRICE_SET.has(item.price.id));

    try {
      if (existingAddonItem) {
        const newQty = (existingAddonItem.quantity ?? 0) + additionalQuantity;
        await logDebug(admin, `Updating addon ${existingAddonItem.id} qty=${newQty}`);
        await stripe.subscriptionItems.update(existingAddonItem.id, {
          quantity: newQty,
          proration_behavior: "always_invoice",
          payment_behavior: "error_if_incomplete",
        });
      } else {
        await logDebug(admin, `Creating addon price=${catalogAddonPriceId} qty=${additionalQuantity}`);
        await stripe.subscriptionItems.create({
          subscription: subscriptionId,
          price: catalogAddonPriceId,
          quantity: additionalQuantity,
          proration_behavior: "always_invoice",
          payment_behavior: "error_if_incomplete",
        });
      }
    } catch (err) {
      const e = err as Stripe.errors.StripeError;
      await logDebug(admin, `Stripe error: ${e?.code ?? "-"} ${e?.message ?? ""}`);
      const message = e?.code === "authentication_required"
        ? "Tu banco pidió autenticar el pago. Escríbenos por WhatsApp y lo completamos juntos."
        : e?.type === "StripeCardError"
          ? `No pudimos cobrar con tu tarjeta: ${e.message}`
          : "No pudimos agregar el catálogo. Intenta de nuevo o escríbenos por WhatsApp.";
      return json({ success: false, error: message, code: e?.code ?? null }, 402);
    }

    const newExtraCatalogs = (tenantRow.extra_catalogs ?? 0) + additionalQuantity;
    await admin.from("tenants").update({ extra_catalogs: newExtraCatalogs }).eq("id", Number(tenantId));

    await logDebug(admin, `Success! extraCatalogs=${newExtraCatalogs}`);
    return json({ success: true, extraCatalogs: newExtraCatalogs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const stack = err instanceof Error ? err.stack : "";
    await logDebug(admin, `UNHANDLED: ${message} | ${stack}`);
    return json({ success: false, error: "No pudimos agregar el catálogo. Intenta de nuevo o escríbenos por WhatsApp." }, 500);
  }
});
