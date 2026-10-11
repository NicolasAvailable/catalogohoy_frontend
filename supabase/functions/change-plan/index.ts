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
// Switch a decimales (2026-10-08): Pro $19.99 / Avanzado $34.99; basico (11.99)
// vuelve a ofrecerse. quarterly inerte.
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

// Price IDs históricos que siguen ANCLADOS a suscripciones vigentes. No se usan
// para cobrar upgrades (eso sale de PRICE_MAP), pero PRICE_TO_PLAN los necesita
// para reconocer el ítem de plan dentro de una suscripción existente — si falta
// el ID, el upgrade cae a `plan_item_not_found` y el front hace checkout a
// precio COMPLETO sin acreditar lo no usado (bug Aglaia). Inventario COMPLETO
// de los 3 productos en Stripe live (2026-10-08, incluye precios archivados):
// pro prod_UvXD7BXlWjSsUN, avanzado prod_U4NQhPd3F2XD85, basico prod_U4NQdQmoKgPBfl.
const LEGACY_PRICES: Record<string, { planId: string; period: string }> = {
  // ── pro ──
  "price_1UL59T85rys2QLXdkrWZiIh1": { planId: "pro", period: "monthly" },   // $20 (switch 2026-09)
  "price_1UL59g85rys2QLXdp7UiCjCQ": { planId: "pro", period: "annual" },    // $120 (switch 2026-09)
  "price_1UBcwt85rys2QLXdqUs4wZKT": { planId: "pro", period: "annual" },    // $119.94
  "price_1TyBrh85rys2QLXd7Q9EPKKF": { planId: "pro", period: "annual" },    // $199.90 (2 meses gratis jul)
  "price_1TyBl685rys2QLXdwXHCBjvu": { planId: "pro", period: "annual" },    // $219.89 (archivado)
  "price_1TyBl585rys2QLXdc1GUWVJh": { planId: "pro", period: "monthly" },   // $19.99 (regen jul)
  "price_1Twl8D85rys2QLXdriJD6mKz": { planId: "pro", period: "annual" },    // $179.91
  "price_1TvgA385rys2QLXdZTw9tolK": { planId: "pro", period: "annual" },    // $203.90 (pre-jul)
  "price_1Tvg9u85rys2QLXdaDdgvbii": { planId: "pro", period: "quarterly" }, // $53.97 (pre-jul)
  "price_1Tvg9h85rys2QLXd18YBSdOk": { planId: "pro", period: "monthly" },   // $19.99 (pre-jul)
  // ── avanzado ──
  "price_1UL59m85rys2QLXdC40TyaQE": { planId: "avanzado", period: "monthly" },   // $35 (switch 2026-09)
  "price_1UL59r85rys2QLXdnrsXjQis": { planId: "avanzado", period: "annual" },    // $210 (switch 2026-09)
  "price_1UBcwu85rys2QLXdJVEue0XU": { planId: "avanzado", period: "annual" },    // $179.94
  "price_1TyBrh85rys2QLXdtGFJFkPf": { planId: "avanzado", period: "annual" },    // $299.90 (2 meses gratis jul)
  "price_1TyBl785rys2QLXdtBSv8PyU": { planId: "avanzado", period: "annual" },    // $329.89 (archivado)
  "price_1TyBl785rys2QLXd08l8YOs7": { planId: "avanzado", period: "monthly" },   // $29.99 (regen jul)
  "price_1Twl8E85rys2QLXdOAhiu0kx": { planId: "avanzado", period: "annual" },    // $269.91
  "price_1TvgAZ85rys2QLXdhNuebVOL": { planId: "avanzado", period: "annual" },    // $305.90 (pre-jul)
  "price_1TvgAO85rys2QLXdfdTCu165": { planId: "avanzado", period: "quarterly" }, // $80.97 (pre-jul)
  "price_1TvgAE85rys2QLXdoNMJFJ6O": { planId: "avanzado", period: "monthly" },   // $29.99 (pre-jul)
  "price_1TGfmh85rys2QLXdBW7wZB1U": { planId: "avanzado", period: "annual" },    // $203.90 (gen 1.5)
  "price_1TGfmh85rys2QLXdH8DRmSqH": { planId: "avanzado", period: "quarterly" }, // $53.97 (gen 1.5)
  "price_1TGfmg85rys2QLXduNXYy9h3": { planId: "avanzado", period: "monthly" },   // $19.99 (gen 1.5)
  "price_1T6Egm85rys2QLXd7SUripKT": { planId: "avanzado", period: "annual" },    // $305.90 (gen 1, archivado)
  "price_1T6Egm85rys2QLXd0xhEdxq5": { planId: "avanzado", period: "quarterly" }, // $80.97 (gen 1, archivado)
  "price_1T6Egl85rys2QLXdgBMNNpb6": { planId: "avanzado", period: "monthly" },   // $29.99 (gen 1, archivado)
  // ── basico ──
  "price_1TyyMD85rys2QLXdtQYv2JBj": { planId: "basico", period: "annual" },    // $99.90
  "price_1TyBl585rys2QLXdrlplXJzX": { planId: "basico", period: "annual" },    // $109.89
  "price_1TyBl485rys2QLXdPdkMqstS": { planId: "basico", period: "quarterly" }, // $26.97 (regen jul)
  "price_1TyBl485rys2QLXd8LCfn4PZ": { planId: "basico", period: "monthly" },   // $9.99 (regen jul)
  "price_1Twl8B85rys2QLXdPxrTsKgi": { planId: "basico", period: "annual" },    // $89.91
  "price_1TGfmg85rys2QLXdxnVflylM": { planId: "basico", period: "annual" },    // $101.90 (gen 1.5)
  "price_1TGfmg85rys2QLXdjyfHoGWn": { planId: "basico", period: "quarterly" }, // $26.97 (gen 1.5)
  "price_1TGfmg85rys2QLXdofh9ytbw": { planId: "basico", period: "monthly" },   // $9.99 (gen 1.5)
  "price_1T6Egl85rys2QLXd2sIJMAO4": { planId: "basico", period: "annual" },    // $152.90 (gen 1, archivado)
  "price_1T6EgQ85rys2QLXdHQlp7Tui": { planId: "basico", period: "quarterly" }, // $40.47 (gen 1, archivado)
  "price_1T6Eg785rys2QLXddxPhqn6B": { planId: "basico", period: "monthly" },   // $14.99 (gen 1, archivado)
};

// priceId → { planId, period }. Sirve para ubicar el ítem de plan dentro de la
// suscripción (ignorando ítems de catálogos adicionales) y mantener el MISMO
// período de facturación en el upgrade. Incluye los precios vigentes
// (PRICE_MAP) y los históricos anclados a subs viejas (LEGACY_PRICES).
const PRICE_TO_PLAN: Record<string, { planId: string; period: string }> = {
  ...LEGACY_PRICES,
};
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
      // Upgrade → pasa a la tarifa nueva, se pierde el precio congelado de
      // cliente antiguo (si lo tenía).
      locked_plan_price: null,
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
