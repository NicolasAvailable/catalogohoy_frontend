// ═══════════════════════════════════════════════════════════════════════════
// change-plan — UPGRADE de plan con PRORRATEO real (cobra SOLO la diferencia).
//
// PROBLEMA QUE RESUELVE:
//   El flujo normal (`create-checkout-session`) SIEMPRE crea una suscripción
//   NUEVA a precio COMPLETO y el webhook cancela la vieja. Stripe Checkout no
//   sabe hacer "upgrade con prorrateo". Resultado: al pasar de Básico a Pro se
//   cobraba el Pro entero en vez de la diferencia (bug reportado por Aglaia,
//   tenant 2092 — se reembolsó a mano). Esta función hace el upgrade correcto:
//   `subscriptions.update` sobre la suscripción EXISTENTE con prorrateo, así
//   Stripe acredita el tiempo no usado del plan viejo y cobra solo el delta.
//
//   `proration_behavior: "always_invoice"` → factura y COBRA la diferencia
//   prorrateada AHORA, con la tarjeta ya guardada (off-session, sin redirect).
//   `payment_behavior: "error_if_incomplete"` → si el banco pide autenticación
//   (SCA/3DS) o rechaza, la llamada FALLA de forma atómica: no cambia el plan
//   ni cobra nada. Devolvemos un error claro y el front cae al flujo manual.
//
// SOLO para UPGRADES (plan pago → plan pago más caro). Downgrades, renovaciones
// y primeras compras siguen por `create-checkout-session`. Si no hay suscripción
// activa o no es un upgrade, respondemos 409/400 y el front usa el checkout
// normal.
//
// ⚠️ El PRICE_MAP debe estar sincronizado con el de `create-checkout-session`.
// Deploy con verify_jwt=true (lo llama el dueño autenticado desde el admin).
// ═══════════════════════════════════════════════════════════════════════════
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};

// Mismos IDs que create-checkout-session (mantener sincronizados).
const PRICE_MAP: Record<string, Record<string, string>> = {
  basico: {
    monthly:   "price_1UBcws85rys2QLXd2VNxshFD",
    quarterly: "price_1UBcwt85rys2QLXd9plZqrRK",
    annual:    "price_1UBcwt85rys2QLXdstJ7waFV",
  },
  pro: {
    monthly:   "price_1TyBl585rys2QLXdc1GUWVJh",
    quarterly: "price_1TyBl585rys2QLXdKk3w7yGm",
    annual:    "price_1UBcwt85rys2QLXdqUs4wZKT",
  },
  avanzado: {
    monthly:   "price_1TyBl785rys2QLXd08l8YOs7",
    quarterly: "price_1TyBl785rys2QLXdp7nbigVf",
    annual:    "price_1UBcwu85rys2QLXdJVEue0XU",
  },
};

// priceId → { planId, period }. Sirve para ubicar el ítem de plan dentro de la
// suscripción (ignorando ítems de catálogos adicionales) y mantener el MISMO
// período de facturación en el upgrade.
const PRICE_TO_PLAN: Record<string, { planId: string; period: string }> = {};
for (const [planId, periods] of Object.entries(PRICE_MAP)) {
  for (const [period, priceId] of Object.entries(periods)) {
    PRICE_TO_PLAN[priceId] = { planId, period };
  }
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// current_period_end migró al nivel de ítem en versiones recientes de la API;
// probamos ambas ubicaciones (igual que getSubPeriodEnd del stripe-webhook).
function subPeriodEnd(sub: Stripe.Subscription): number | null {
  // deno-lint-ignore no-explicit-any
  const itemEnd = (sub as any)?.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === "number") return itemEnd;
  // deno-lint-ignore no-explicit-any
  const subEnd = (sub as any)?.current_period_end;
  return typeof subEnd === "number" ? subEnd : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Autorización: el dueño autenticado desde el admin.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

    const { tenantId, planId } = await req.json();
    if (!tenantId || !planId) return json({ success: false, error: "Faltan parámetros requeridos" }, 400);

    const newPlanPrices = PRICE_MAP[planId];
    if (!newPlanPrices) return json({ success: false, error: "Plan inválido" }, 400);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const admin  = createClient(supabaseUrl, serviceKey);

    // 1.b) El caller debe ser owner/admin DEL TENANT que quiere upgradear: esta
    // función cobra la tarjeta guardada off-session, así que sin este check
    // cualquier usuario autenticado podría forzar el cobro de otro tenant.
    // users_tenants referencia users.id (bigint), no el uuid de auth.
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
          .eq("tenant_id", tenantId)
          .eq("user_id", internalUserId)
          .in("role", ["owner", "admin"])
          .maybeSingle();
    if (!membership) return json({ success: false, error: "forbidden" }, 403);

    // 2) Suscripción actual del tenant.
    const { data: tenantRow } = await admin
      .from("tenants")
      .select("stripe_subscription_id, plan_id")
      .eq("id", tenantId)
      .single();

    const subId = tenantRow?.stripe_subscription_id ?? "";
    const currentPlanId = tenantRow?.plan_id ?? "";
    // Sin suscripción de Stripe no hay nada que prorratear → el front cae al
    // checkout normal (primera compra / plan manual).
    if (!subId) return json({ success: false, error: "no_active_subscription" }, 409);

    // 3) Confirmar que es un UPGRADE (precio destino > precio actual). Los
    //    precios salen de la tabla `plans` (fuente de verdad del monto base).
    const { data: plansRows } = await admin
      .from("plans")
      .select("id, price")
      .in("id", [currentPlanId, planId]);
    const priceOf = (id: string) =>
      Number(plansRows?.find((p: { id: string; price: string | number }) => p.id === id)?.price ?? 0);
    const currentPrice = priceOf(currentPlanId);
    const targetPrice  = priceOf(planId);
    if (!(targetPrice > currentPrice)) {
      return json({ success: false, error: "not_an_upgrade" }, 400);
    }

    // 4) Ubicar el ítem de plan en la suscripción y su período de facturación.
    const sub = await stripe.subscriptions.retrieve(subId);
    if (!["active", "trialing", "past_due"].includes(sub.status)) {
      return json({ success: false, error: "subscription_not_active" }, 409);
    }
    const planItem = sub.items.data.find((it) => it.price?.id && PRICE_TO_PLAN[it.price.id]);
    if (!planItem) {
      return json({ success: false, error: "plan_item_not_found" }, 409);
    }
    const period = PRICE_TO_PLAN[planItem.price!.id].period;
    const newPriceId = newPlanPrices[period];
    if (!newPriceId) return json({ success: false, error: "Período de facturación inválido" }, 400);

    // 5) Upgrade con prorrateo: cambia el precio del ítem de plan y factura +
    //    cobra la diferencia prorrateada AHORA con la tarjeta guardada.
    let updated: Stripe.Subscription;
    try {
      updated = await stripe.subscriptions.update(subId, {
        items: [{ id: planItem.id, price: newPriceId }],
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
        metadata: { tenant_id: String(tenantId), plan_id: planId },
      });
    } catch (err) {
      const e = err as Stripe.errors.StripeError;
      const needsAuth = e?.code === "authentication_required";
      const message = needsAuth
        ? "Tu banco requiere autenticar el pago. Escribinos por WhatsApp y completamos el upgrade juntos."
        : (e?.message ?? "No pudimos cobrar la diferencia con tu tarjeta guardada.");
      return json({ success: false, error: message, code: e?.code ?? null }, 402);
    }

    // 6) Reflejar el plan en el tenant DE INMEDIATO (el webhook
    //    customer.subscription.updated lo confirma después, idempotente). Se
    //    propaga a los tenants hermanos del mismo dueño (mismo criterio que
    //    applyPlanUpdate del stripe-webhook).
    const periodEnd = subPeriodEnd(updated);
    const expiresAtIso = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
    const planUpdate: Record<string, unknown> = {
      plan_id: planId,
      plan_expired: false,
      stripe_subscription_status: updated.status,
    };
    if (expiresAtIso) planUpdate["plan_expires_at"] = expiresAtIso;

    await admin.from("tenants").update(planUpdate).eq("id", tenantId);

    const { data: ownerLink } = await admin
      .from("users_tenants")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .maybeSingle();
    const ownerUserId = (ownerLink as { user_id?: string } | null)?.user_id ?? null;
    if (ownerUserId) {
      const { data: siblings } = await admin
        .from("users_tenants")
        .select("tenant_id")
        .eq("user_id", ownerUserId)
        .eq("role", "owner")
        .neq("tenant_id", tenantId);
      const siblingIds = (siblings ?? [])
        .map((r: { tenant_id: number }) => r.tenant_id)
        .filter((id: number) => id !== Number(tenantId));
      if (siblingIds.length > 0) {
        await admin.from("tenants").update(planUpdate).in("id", siblingIds);
      }
    }

    return json({ success: true, subscriptionId: updated.id }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return json({ success: false, error: message }, 500);
  }
});
