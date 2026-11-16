import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  advanceDomain,
  BridgeError,
  DOMAIN_COLUMNS,
  type DomainRow,
  isSandboxTenant,
  normalizeQuery,
  quote,
  SELL_TLDS,
  stripeConfigured,
  stripeFor,
} from "../_shared/domains.ts";
import { currencyForCountry, formatMinor, isZeroDecimal, usdCentsToMinor } from "../_shared/credit-pack.ts";

// Venta de dominios dentro de CatalogoHoy (Namecheap). Una sola función con
// acciones:
//   search   {tenantId, query}            → disponibilidad + precio final por año
//   checkout {tenantId, domain, returnUrl, successUrl?} → sesión de Stripe (suscripción anual)
//   status   {tenantId}                    → dominios de la tienda (y los avanza)
//   cancel   {tenantId, id}                → no renovar al vencer
//   provision (x-cron-secret)              → avanza todos los pendientes (cron)
//
// Solo el dueño/admin de la tienda puede buscar, comprar o cancelar. El precio
// se calcula SIEMPRE aquí (nunca se confía en el cliente). El estado de cada
// compra vive en `tenant_domains`; ver _shared/domains.ts.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Evita open-redirect: solo dominios catalogohoy, dominios propios conocidos o localhost.
// deno-lint-ignore no-explicit-any
async function safeReturn(admin: any, url: unknown, tenantId: number): Promise<string> {
  const fallback = "https://catalogohoy.com/admin";
  if (typeof url !== "string") return fallback;
  try {
    const u = new URL(url);
    if (u.hostname === "localhost") return url;
    if (u.protocol !== "https:") return fallback;
    if (u.hostname === "catalogohoy.com" || u.hostname.endsWith(".catalogohoy.com")) return url;
    const { data } = await admin.from("tenants").select("custom_domain").eq("id", tenantId).maybeSingle();
    const cd = (data as { custom_domain?: string | null } | null)?.custom_domain;
    if (cd && (u.hostname === cd || u.hostname === `www.${cd}`)) return url;
  } catch { /* noop */ }
  return fallback;
}

const LIVE_STATUSES = ["pending_payment", "paid", "registering", "registered", "connecting", "active", "canceled"];
const IN_PROGRESS = ["paid", "registering", "registered", "connecting"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }
  const action = String(body?.action ?? "");

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripe = new Stripe(stripeKey ?? "sk_missing");

  // ── Cron: avanzar todos los pendientes ───────────────────────────────────
  if (action === "provision") {
    const cronSecret = Deno.env.get("DOMAINS_CRON_SECRET");
    if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }
    const nowIso = new Date().toISOString();
    const { data: rows } = await admin
      .from("tenant_domains")
      .select(DOMAIN_COLUMNS)
      .or(`status.in.(${IN_PROGRESS.join(",")}),and(status.eq.canceled,expires_at.lt.${nowIso})`)
      .limit(50);
    // Pedidos que nunca se pagaron (checkout abandonado) → liberar el dominio.
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    await admin.from("tenant_domains").update({ status: "abandoned" }).eq("status", "pending_payment").lt("created_at", cutoff);
    const results: Record<string, string> = {};
    for (const row of (rows ?? []) as DomainRow[]) {
      try {
        results[row.domain] = await advanceDomain(admin, stripe, row);
      } catch (err) {
        results[row.domain] = `error: ${(err as Error).message}`;
      }
    }
    return json({ success: true, results });
  }

  // ── Acciones de usuario: auth + dueño/admin de la tienda ─────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ success: false, error: "Unauthorized" }, 401);

  const tenantId = Number(body?.tenantId);
  if (!Number.isInteger(tenantId) || tenantId <= 0) return json({ success: false, error: "Tienda inválida" }, 400);

  const { data: internalUser } = await admin.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();
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
  if (!membership) return json({ success: false, error: "Solo el dueño de la tienda puede gestionar dominios." }, 403);

  // Tiendas de prueba: Stripe de prueba + sandbox de Namecheap (ver _shared/domains.ts).
  const sandbox = isSandboxTenant(tenantId);
  const tStripe = sandbox ? stripeFor(true) : stripe;
  const tStripeOk = stripeConfigured(sandbox);

  // Moneda de la tienda: se muestra y se cobra en la moneda del país del
  // catálogo (misma tabla FX que los planes). Venezuela y el resto, USD.
  const { data: tenantRow } = await admin.from("tenants").select("country_code").eq("id", tenantId).maybeSingle();
  const currency = currencyForCountry((tenantRow as { country_code?: string | null } | null)?.country_code);
  const local = (usdCents: number | null | undefined) =>
    usdCents == null ? null : usdCentsToMinor(usdCents, currency);

  try {
    // ── search ─────────────────────────────────────────────────────────────
    if (action === "search") {
      const q = normalizeQuery(body?.query);
      if (!q) return json({ success: false, error: "Escribe un nombre válido (letras, números y guiones)." }, 400);
      const tlds = q.tld ? [q.tld, ...SELL_TLDS.filter((t) => t !== q.tld)] : SELL_TLDS;
      const domains = tlds.map((t) => `${q.label}.${t}`);
      const quotes = await quote(domains, sandbox);
      return json({
        success: true,
        query: q.label,
        currency,
        zeroDecimal: isZeroDecimal(currency),
        results: quotes.map((r) => ({
          domain: r.domain,
          tld: r.tld,
          available: r.available,
          sellable: r.sellable,
          reason: r.reason ?? null,
          priceCents: r.priceCents ?? null,
          firstYearPriceCents: r.firstYearPriceCents ?? null,
          // Montos en unidades menores de `currency` (lo que cobra Stripe).
          localPrice: local(r.priceCents),
          localFirstYearPrice: local(r.firstYearPriceCents ?? r.priceCents),
        })),
      });
    }

    // ── status ─────────────────────────────────────────────────────────────
    if (action === "status") {
      const { data: rows } = await admin
        .from("tenant_domains")
        .select(DOMAIN_COLUMNS + ", auto_renew, activated_at, created_at, last_error")
        .eq("tenant_id", tenantId)
        .in("status", [...LIVE_STATUSES, "refunded"])
        .order("created_at", { ascending: false })
        .limit(10);
      const list = (rows ?? []) as (DomainRow & Record<string, unknown>)[];
      // La app consulta mientras espera: aprovechamos para avanzar lo pendiente.
      for (const row of list) {
        if (IN_PROGRESS.includes(row.status)) {
          try {
            row.status = await advanceDomain(admin, stripe, row);
          } catch { /* el cron lo reintenta */ }
        }
      }
      return json({
        success: true,
        domains: list
          .filter((r) => r.status !== "pending_payment")
          .map((r) => ({
            id: r.id,
            domain: r.domain,
            status: r.status,
            priceCents: r.price_cents,
            autoRenew: r.auto_renew,
            expiresAt: r.expires_at,
            activatedAt: r.activated_at,
            createdAt: r.created_at,
          })),
      });
    }

    // ── checkout ───────────────────────────────────────────────────────────
    if (action === "checkout") {
      if (!tStripeOk) return json({ success: false, error: "Stripe no configurado" }, 500);
      const domain = String(body?.domain ?? "").trim().toLowerCase();
      const q = normalizeQuery(domain);
      if (!q?.tld || `${q.label}.${q.tld}` !== domain) return json({ success: false, error: "Dominio inválido" }, 400);

      // Una tienda = un dominio comprado vivo a la vez.
      const { data: existing } = await admin
        .from("tenant_domains")
        .select("domain, status")
        .eq("tenant_id", tenantId)
        .in("status", ["paid", "registering", "registered", "connecting", "active"])
        .limit(1);
      if (existing && existing.length) {
        return json({ success: false, error: `Tu tienda ya tiene el dominio ${existing[0].domain}.` }, 409);
      }

      const [qt] = await quote([domain], sandbox);
      if (!qt?.sellable || !qt.priceCents) {
        return json({ success: false, error: "Ese dominio ya no está disponible." }, 409);
      }

      const { data: tenant } = await admin.from("tenants").select("name, slug").eq("id", tenantId).maybeSingle();
      const base = await safeReturn(admin, body?.returnUrl, tenantId);
      const sep = base.includes("?") ? "&" : "?";
      // Pantalla de éxito propia (si la manda la app); si no, se vuelve a returnUrl.
      const okBase = body?.successUrl ? await safeReturn(admin, body.successUrl, tenantId) : base;
      const okSep = okBase.includes("?") ? "&" : "?";

      // Reservar la fila primero (el índice único evita que dos tiendas paguen
      // el mismo dominio a la vez). Liberar reservas viejas de este dominio.
      const cutoff = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      await admin.from("tenant_domains").update({ status: "abandoned" })
        .eq("domain", domain).eq("status", "pending_payment").lt("created_at", cutoff);
      const { data: inserted, error: insErr } = await admin.from("tenant_domains").insert({
        tenant_id: tenantId,
        domain,
        register_cost_cents: qt.registerCostCents,
        renew_cost_cents: qt.renewCostCents,
        price_cents: qt.priceCents,
        first_year_price_cents: qt.firstYearPriceCents ?? qt.priceCents,
        requested_by: user.id,
      }).select("id").single();
      if (insErr || !inserted) {
        return json({ success: false, error: insErr?.code === "23505" ? "Alguien está comprando ese dominio ahora mismo. Prueba otro." : "No se pudo iniciar la compra." }, 409);
      }

      // Metadata SIN `tenant_id` a propósito: así los handlers de planes del
      // stripe-webhook ignoran esta suscripción. Se identifica con type=domain.
      // Primer año más barato: descuento de una sola vez sobre la primera
      // factura (la suscripción renueva al precio completo).
      const yearly = usdCentsToMinor(qt.priceCents, currency);
      const firstYear = usdCentsToMinor(qt.firstYearPriceCents ?? qt.priceCents, currency);
      const introOff = yearly - firstYear;
      const coupon = introOff > 0
        ? await tStripe.coupons.create({
          amount_off: introOff,
          currency,
          duration: "once",
          max_redemptions: 1,
          name: "Primer año del dominio",
          metadata: { type: "domain_first_year", domain },
        })
        : null;

      const metadata = {
        type: "domain",
        tenant_domain_id: inserted.id,
        domain_tenant_id: String(tenantId),
        domain,
      };
      const session = await tStripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: user.email ?? undefined,
        line_items: [{
          price_data: {
            currency,
            unit_amount: yearly,
            recurring: { interval: "year" },
            product_data: {
              name: `Dominio ${domain}`,
              description: `Dominio para el catálogo ${tenant?.name ?? tenant?.slug ?? ""}. Renovación anual. Sin reembolso después de registrado.`.trim(),
            },
          },
          quantity: 1,
        }],
        ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
        metadata,
        subscription_data: { metadata, description: `Dominio ${domain}` },
        custom_text: {
          submit: {
            message: `El dominio se registra apenas se confirme el pago y no es reembolsable después. Desde el segundo año se renueva a ${formatMinor(yearly, currency)} al año; puedes cancelar la renovación cuando quieras.`,
          },
        },
        success_url: `${okBase}${okSep}domain_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}${sep}domain=cancel`,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 h
      });
      await admin.from("tenant_domains").update({ stripe_session_id: session.id }).eq("id", inserted.id);
      return json({ success: true, url: session.url });
    }

    // ── cancel (no renovar) ────────────────────────────────────────────────
    if (action === "cancel") {
      const id = String(body?.id ?? "");
      const { data: row } = await admin
        .from("tenant_domains")
        .select("id, status, stripe_subscription_id")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!row || row.status !== "active") return json({ success: false, error: "Dominio no encontrado" }, 404);
      if (row.stripe_subscription_id && tStripeOk) {
        await tStripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: true });
      }
      await admin.from("tenant_domains").update({ auto_renew: false }).eq("id", row.id);
      return json({ success: true });
    }

    return json({ success: false, error: "Acción inválida" }, 400);
  } catch (err) {
    if (err instanceof BridgeError && err.code === "not_configured") {
      return json({ success: false, error: "La compra de dominios todavía no está disponible." }, 503);
    }
    console.error(`domains ${action} error:`, err);
    return json({ success: false, error: "No pudimos consultar los dominios. Intenta de nuevo." }, 500);
  }
});
