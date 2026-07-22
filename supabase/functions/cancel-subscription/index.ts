import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

// Cancela la suscripción de un tenant.
//
// Dos caminos según cómo paga el tenant:
//
//  1) Pago con Stripe (tiene stripe_subscription_id): programamos la
//     cancelación al FINAL del período ya pagado (cancel_at_period_end), para
//     que no pierda los días que ya pagó. Stripe emitirá luego el evento
//     `customer.subscription.deleted` que el webhook usa para marcar
//     plan_expired = true. Aquí solo reflejamos el estado "programado".
//
//  2) Pago manual / pago móvil (Venezuela): estos tenants NO tienen
//     suscripción en Stripe — pagan por transferencia/pago móvil y su plan se
//     gestiona a mano. Aquí no hay nada que cancelar en Stripe: solo marcamos
//     el plan como cancelado en la DB (plan_expired = true) de inmediato.
//
// Solo el OWNER del tenant puede cancelar (mismo criterio que
// create-billing-portal-session).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

  // ── Auth: usuario autenticado ──────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
  const authUserId = userRes.user.id;

  // ── Body ───────────────────────────────────────────────────────────
  let body: { tenantId?: number | string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const tenantId = body.tenantId == null ? null : Number(body.tenantId);
  if (!tenantId || Number.isNaN(tenantId)) {
    return json({ error: "tenantId is required" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // ── Autorización: solo el owner del tenant ─────────────────────────
  const { data: ownerRow } = await admin
    .from("users_tenants")
    .select("users!inner(auth_user_id)")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerAuthId = (ownerRow as any)?.users?.auth_user_id ?? null;
  if (!ownerAuthId || ownerAuthId !== authUserId) {
    return json({ error: "Forbidden" }, 403);
  }

  // ── Estado actual del tenant ───────────────────────────────────────
  const { data: tenantRow } = await admin
    .from("tenants")
    .select("plan_id, stripe_subscription_id, stripe_subscription_status")
    .eq("id", tenantId)
    .maybeSingle();
  const tenant = tenantRow as {
    plan_id?: string | null;
    stripe_subscription_id?: string | null;
    stripe_subscription_status?: string | null;
  } | null;

  if (!tenant) return json({ error: "Tenant not found" }, 404);

  // Ya no tiene plan pago que cancelar.
  if (!tenant.plan_id || tenant.plan_id === "gratis") {
    return json({ error: "no_active_plan" }, 400);
  }

  const subId = tenant.stripe_subscription_id ?? null;

  // ── Caso 2: pago manual / Venezuela (sin suscripción Stripe) ───────
  // No hay nada que cancelar en Stripe. Marcamos el plan como cancelado en la
  // DB directamente. El acceso se corta según plan_expired / plan_expires_at.
  if (!subId) {
    await admin
      .from("tenants")
      .update({
        plan_expired: true,
        stripe_subscription_status: "canceled",
      })
      .eq("id", tenantId);
    return json({
      success: true,
      mode: "manual",
      canceled: true,
      immediate: true,
      active_until: null,
    });
  }

  // ── Caso 1: pago con Stripe ────────────────────────────────────────
  if (!stripeKey) return json({ error: "Stripe no configurado" }, 500);
  const stripe = new Stripe(stripeKey);

  // Suscripciones EN MORA (el cobro de renovación falló y Stripe la está
  // reintentando): el período ya venció, así que "cancelar al final del
  // período" no detiene los reintentos ni cambia el estado visible — el
  // cliente sigue viendo past_due y cree que no se canceló. En estos estados
  // cancelamos de INMEDIATO. Con suscripciones al día se respeta el período
  // ya pagado (cancel_at_period_end).
  const DUNNING_STATUSES = new Set([
    "past_due",
    "unpaid",
    "incomplete",
    "incomplete_expired",
  ]);
  const cancelNow = DUNNING_STATUSES.has(tenant.stripe_subscription_status ?? "");

  try {
    if (cancelNow) {
      await stripe.subscriptions.cancel(subId);
      // Cortamos el acceso ya. El webhook (customer.subscription.deleted)
      // confirmará el mismo estado — idempotente.
      await admin
        .from("tenants")
        .update({ plan_expired: true, stripe_subscription_status: "canceled" })
        .eq("id", tenantId);
      return json({
        success: true,
        mode: "stripe",
        canceled: true,
        immediate: true,
        active_until: null,
      });
    }

    // Al día: cancelar al final del período ya pagado — el tenant conserva su
    // plan hasta la fecha que ya pagó, y no se le cobra la próxima renovación.
    const updated = await stripe.subscriptions.update(subId, {
      cancel_at_period_end: true,
    });

    // Reflejar en la DB que la cancelación quedó programada. NO ponemos
    // plan_expired = true todavía: el plan sigue válido hasta fin de período;
    // será el webhook (customer.subscription.deleted) quien lo expire cuando
    // Stripe realmente borre la suscripción al terminar el ciclo.
    await admin
      .from("tenants")
      .update({ stripe_subscription_status: updated.status })
      .eq("id", tenantId);

    // Fecha hasta la que sigue activo (fin del período actual).
    let cancelAtIso: string | null = null;
    const items = updated.items?.data ?? [];
    for (const item of items) {
      const cpe = (item as unknown as { current_period_end?: number })
        .current_period_end;
      if (typeof cpe === "number" && Number.isFinite(cpe)) {
        cancelAtIso = new Date(cpe * 1000).toISOString();
        break;
      }
    }

    return json({
      success: true,
      mode: "stripe",
      canceled: true,
      immediate: false,
      cancel_at_period_end: true,
      active_until: cancelAtIso,
    });
  } catch (err) {
    console.error("cancel-subscription failed:", err);
    return json({ error: "No se pudo cancelar la suscripción" }, 500);
  }
});
