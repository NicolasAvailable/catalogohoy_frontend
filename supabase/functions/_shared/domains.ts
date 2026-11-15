// Venta de dominios (Namecheap) — lógica compartida entre la edge function
// `domains` y el `stripe-webhook`.
//
// Piezas:
//   • bridge(): llama al servicio `domain-bridge` (IP fija, habla con Namecheap).
//   • vercel*(): conecta el dominio al proyecto del catálogo en Vercel.
//   • quote(): disponibilidad + costo + precio al cliente (autoritativo).
//   • advanceDomain(): máquina de estados de una fila de `tenant_domains`.
//
// Toda transición usa un UPDATE condicional (`status = <esperado>`) como
// candado: si el webhook y el cron (o el polling de la app) llegan a la vez,
// solo uno gana y el dominio nunca se compra dos veces.

import Stripe from "npm:stripe@17";

// deno-lint-ignore no-explicit-any
type Admin = any;

export interface DomainRow {
  id: string;
  tenant_id: number;
  domain: string;
  status: string;
  years: number;
  register_cost_cents: number;
  renew_cost_cents: number;
  price_cents: number;
  stripe_session_id: string | null;
  stripe_subscription_id: string | null;
  provider_order_id: string | null;
  attempts: number;
  expires_at: string | null;
}

// ── Configuración ──────────────────────────────────────────────────────────
/** Terminaciones que vendemos, en el orden en que se muestran. */
export const SELL_TLDS = ["com", "net", "xyz", "online", "store", "shop", "site", "co"];
/** Margen anual que nos queda después de Stripe (USD). */
export function marginCents(): number {
  const v = Number(Deno.env.get("DOMAIN_MARGIN_USD") ?? "10");
  return Math.round((Number.isFinite(v) && v >= 0 ? v : 10) * 100);
}
/** No vendemos dominios cuyo costo anual pase de esto (USD). */
const MAX_COST_CENTS = Math.round(Number(Deno.env.get("DOMAIN_MAX_COST_USD") ?? "60") * 100);
/** Comisión de Stripe con tarjeta internacional (aprox.): 4.4% + $0.30. */
const STRIPE_PCT = 0.044;
const STRIPE_FIXED_CENTS = 30;
/** Si al comprar el costo subió más que esto sobre lo cotizado, no se compra. */
const PRICE_TOLERANCE_CENTS = 200;
/** Intentos de los pasos de DNS/Vercel antes de avisar a Slack. */
const MAX_ATTEMPTS = 12;

/** Precio anual al cliente: (costo + margen + fijo Stripe) / (1 - % Stripe), a .99. */
export function salePriceCents(registerCents: number, renewCents: number): number {
  const cost = Math.max(registerCents, renewCents);
  const raw = (cost + marginCents() + STRIPE_FIXED_CENTS) / (1 - STRIPE_PCT);
  return Math.ceil(raw / 100) * 100 - 1;
}

// ── domain-bridge ──────────────────────────────────────────────────────────
export class BridgeError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export async function bridge<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const url = Deno.env.get("DOMAIN_BRIDGE_URL");
  const secret = Deno.env.get("DOMAIN_BRIDGE_SECRET");
  if (!url || !secret) throw new BridgeError("La venta de dominios no está configurada", "not_configured");
  const res = await fetch(`${url.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bridge-secret": secret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(70_000),
  });
  let json: { ok?: boolean; data?: T; error?: string; code?: string } = {};
  try {
    json = await res.json();
  } catch { /* noop */ }
  if (!res.ok || !json.ok) {
    throw new BridgeError(json.error ?? `domain-bridge ${res.status}`, json.code ?? String(res.status));
  }
  return json.data as T;
}

interface CheckResult {
  domain: string;
  available: boolean;
  premium: boolean;
}
type Pricing = Record<string, { registerCents: number | null; renewCents: number | null }>;

// ── Búsqueda / cotización ──────────────────────────────────────────────────
export interface Quote {
  domain: string;
  tld: string;
  available: boolean;
  /** false = existe pero no lo vendemos (premium, muy caro o sin precio). */
  sellable: boolean;
  reason?: "taken" | "premium" | "too_expensive" | "no_price";
  registerCostCents?: number;
  renewCostCents?: number;
  priceCents?: number;
}

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Limpia lo que escribe el cliente: acentos, espacios, http://, www., etc. */
export function normalizeQuery(raw: string): { label: string; tld: string | null } | null {
  let s = String(raw ?? "").trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/g, "n");
  const dot = s.indexOf(".");
  let label = dot >= 0 ? s.slice(0, dot) : s;
  const tld = dot >= 0 ? s.slice(dot + 1) : null;
  label = label.replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (label.length < 2 || !LABEL_RE.test(label)) return null;
  return { label, tld: tld && SELL_TLDS.includes(tld) ? tld : null };
}

export function tldOf(domain: string): string {
  return domain.slice(domain.indexOf(".") + 1);
}

/** Cotiza dominios exactos. El precio sale SIEMPRE de aquí (nunca del cliente). */
export async function quote(domains: string[]): Promise<Quote[]> {
  const tlds = [...new Set(domains.map(tldOf))];
  const [checks, pricing] = await Promise.all([
    bridge<CheckResult[]>("/check", { domains }),
    bridge<Pricing>("/pricing", { tlds }),
  ]);
  const byDomain = new Map(checks.map((c) => [c.domain, c]));
  return domains.map((domain) => {
    const tld = tldOf(domain);
    const c = byDomain.get(domain);
    const p = pricing[tld];
    const base: Quote = { domain, tld, available: !!c?.available, sellable: false };
    if (!c?.available) return { ...base, reason: "taken" };
    if (c.premium) return { ...base, reason: "premium" };
    if (!p?.registerCents || !p?.renewCents) return { ...base, reason: "no_price" };
    if (Math.max(p.registerCents, p.renewCents) > MAX_COST_CENTS) return { ...base, reason: "too_expensive" };
    return {
      ...base,
      sellable: true,
      registerCostCents: p.registerCents,
      renewCostCents: p.renewCents,
      priceCents: salePriceCents(p.registerCents, p.renewCents),
    };
  });
}

// ── Vercel ─────────────────────────────────────────────────────────────────
function vercelUrl(path: string): string {
  const team = Deno.env.get("VERCEL_TEAM_ID");
  const sep = path.includes("?") ? "&" : "?";
  return `https://api.vercel.com${path}${team ? `${sep}teamId=${encodeURIComponent(team)}` : ""}`;
}
async function vercel(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const token = Deno.env.get("VERCEL_TOKEN");
  if (!token) throw new Error("VERCEL_TOKEN no configurado");
  const res = await fetch(vercelUrl(path), {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch { /* noop */ }
  return { status: res.status, body };
}
function vercelProject(): string {
  return encodeURIComponent(Deno.env.get("VERCEL_PROJECT") ?? "catalogohoy-dashboard");
}

/** Agrega `dominio` y `www.dominio` (redirige al apex) al proyecto. Idempotente. */
export async function vercelAttach(domain: string): Promise<void> {
  const p = vercelProject();
  for (const payload of [{ name: domain }, { name: `www.${domain}`, redirect: domain, redirectStatusCode: 308 }]) {
    const r = await vercel(`/v10/projects/${p}/domains`, { method: "POST", body: JSON.stringify(payload) });
    if (r.status >= 200 && r.status < 300) continue;
    // Ya agregado a ESTE proyecto = ok.
    const code = (r.body.error as { code?: string } | undefined)?.code ?? "";
    if (r.status === 409 || code === "domain_already_exists" || code === "domain_already_in_use") {
      const g = await vercel(`/v9/projects/${p}/domains/${encodeURIComponent(payload.name)}`);
      if (g.status === 200) continue;
    }
    throw new Error(`Vercel ${r.status} al agregar ${payload.name}: ${JSON.stringify(r.body.error ?? r.body)}`);
  }
}

/** true cuando Vercel ya ve el DNS bien (y por lo tanto emite el SSL). */
export async function vercelReady(domain: string): Promise<boolean> {
  const p = vercelProject();
  const pd = await vercel(`/v9/projects/${p}/domains/${encodeURIComponent(domain)}`);
  if (pd.status !== 200 || pd.body.verified !== true) {
    // Dispara la verificación por si quedó pendiente.
    await vercel(`/v9/projects/${p}/domains/${encodeURIComponent(domain)}/verify`, { method: "POST" });
    return false;
  }
  const cfg = await vercel(`/v6/domains/${encodeURIComponent(domain)}/config`);
  return cfg.status === 200 && cfg.body.misconfigured === false;
}

// ── Slack ──────────────────────────────────────────────────────────────────
export async function notifySlack(title: string, text: string): Promise<void> {
  const url = Deno.env.get("SLACK_PAYMENTS_WEBHOOK_URL");
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: title,
        blocks: [
          { type: "header", text: { type: "plain_text", text: title, emoji: true } },
          { type: "section", text: { type: "mrkdwn", text } },
        ],
      }),
    });
  } catch { /* noop */ }
}

async function tenantLabel(admin: Admin, tenantId: number): Promise<string> {
  const { data } = await admin.from("tenants").select("name, slug").eq("id", tenantId).maybeSingle();
  return data ? `${data.name ?? "-"} (${data.slug ?? tenantId})` : `Tenant #${tenantId}`;
}

// ── Stripe: reembolso si la compra falla ───────────────────────────────────
export async function refundDomain(admin: Admin, stripe: Stripe, row: DomainRow, reason: string): Promise<void> {
  let refunded = false;
  try {
    if (row.stripe_subscription_id) {
      const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id, { expand: ["latest_invoice"] });
      // deno-lint-ignore no-explicit-any
      const inv = sub.latest_invoice as any;
      const pi: string | null = typeof inv?.payment_intent === "string"
        ? inv.payment_intent
        : inv?.payment_intent?.id ?? inv?.payments?.data?.[0]?.payment?.payment_intent ?? null;
      const charge: string | null = typeof inv?.charge === "string" ? inv.charge : null;
      if (pi) {
        await stripe.refunds.create({ payment_intent: pi, reason: "requested_by_customer", metadata: { tenant_domain_id: row.id } });
        refunded = true;
      } else if (charge) {
        await stripe.refunds.create({ charge, reason: "requested_by_customer", metadata: { tenant_domain_id: row.id } });
        refunded = true;
      }
      if (sub.status !== "canceled") await stripe.subscriptions.cancel(sub.id);
    }
  } catch (err) {
    reason = `${reason} · reembolso falló: ${(err as Error).message}`;
  }
  await admin.from("tenant_domains")
    .update({ status: refunded ? "refunded" : "failed", last_error: reason.slice(0, 1000) })
    .eq("id", row.id);
  await notifySlack(
    refunded ? "↩️ Dominio no comprado — pago devuelto" : "🚨 Dominio no comprado — DEVOLVER A MANO",
    `*${row.domain}* · ${await tenantLabel(admin, row.tenant_id)}\n${reason}`,
  );
}

// ── Máquina de estados ─────────────────────────────────────────────────────
/** Pasa la fila a `to` solo si sigue en `from`. Devuelve true si ganó el candado. */
async function claim(admin: Admin, id: string, from: string, to: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  const { data } = await admin.from("tenant_domains").update({ status: to, ...extra }).eq("id", id).eq("status", from).select("id");
  return Array.isArray(data) && data.length > 0;
}

async function bumpAttempt(admin: Admin, row: DomainRow, err: unknown): Promise<void> {
  const attempts = (row.attempts ?? 0) + 1;
  const msg = (err as Error)?.message ?? String(err);
  await admin.from("tenant_domains").update({ attempts, last_error: msg.slice(0, 1000) }).eq("id", row.id);
  if (attempts === MAX_ATTEMPTS) {
    await notifySlack("⚠️ Dominio trabado", `*${row.domain}* (${row.status}) · ${await tenantLabel(admin, row.tenant_id)}\n${msg}`);
  }
}

/**
 * Avanza UNA fila todo lo que pueda en esta llamada. Seguro de llamar muchas
 * veces y en paralelo. Devuelve el estado final.
 */
export async function advanceDomain(admin: Admin, stripe: Stripe, row: DomainRow): Promise<string> {
  let current = row;

  // 1) paid → comprar en Namecheap.
  if (current.status === "paid") {
    if (!(await claim(admin, current.id, "paid", "registering"))) return current.status;
    try {
      // Revalidar disponibilidad y costo justo antes de comprar.
      const [q] = await quote([current.domain]);
      if (!q?.sellable) {
        await refundDomain(admin, stripe, current, `Ya no se puede comprar (${q?.reason ?? "sin respuesta"})`);
        return "refunded";
      }
      if ((q.registerCostCents ?? 0) > current.register_cost_cents + PRICE_TOLERANCE_CENTS ||
          (q.renewCostCents ?? 0) > current.renew_cost_cents + PRICE_TOLERANCE_CENTS) {
        await refundDomain(admin, stripe, current, `El costo subió (registro ${q.registerCostCents}, renovación ${q.renewCostCents} centavos)`);
        return "refunded";
      }
      const r = await bridge<{ orderId: string | null; domainId: string | null; chargedCents: number | null }>(
        "/register",
        { domain: current.domain, years: current.years },
      );
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + current.years);
      await admin.from("tenant_domains").update({
        status: "registered",
        provider_order_id: r.orderId,
        provider_domain_id: r.domainId,
        registered_at: new Date().toISOString(),
        expires_at: expires.toISOString(),
        attempts: 0,
        last_error: null,
      }).eq("id", current.id);
      current = { ...current, status: "registered", attempts: 0 };
      // Aviso de saldo bajo (no bloquea).
      try {
        const b = await bridge<{ availableCents: number }>("/balance");
        const min = Math.round(Number(Deno.env.get("DOMAIN_LOW_BALANCE_USD") ?? "40") * 100);
        if (b.availableCents < min) {
          await notifySlack("💸 Saldo bajo en Namecheap", `Quedan $${(b.availableCents / 100).toFixed(2)}. Recarga para seguir vendiendo dominios.`);
        }
      } catch { /* noop */ }
    } catch (err) {
      // Error de Namecheap al registrar (saldo, dominio tomado, etc.): devolver.
      // Un error de red puede dejar la duda de si se registró; en ese caso NO
      // devolvemos a ciegas: lo dejamos en `registering` y avisamos.
      if (err instanceof BridgeError && err.code !== "internal" && !/^\d{3}$/.test(err.code)) {
        await refundDomain(admin, stripe, current, `Namecheap: ${err.message}`);
        return "refunded";
      }
      await admin.from("tenant_domains").update({ last_error: String((err as Error).message).slice(0, 1000) }).eq("id", current.id);
      await notifySlack("🚨 Compra de dominio incierta — revisar en Namecheap", `*${current.domain}* · ${await tenantLabel(admin, current.tenant_id)}\n${(err as Error).message}\nQuedó en "registering". Si se registró, pásalo a "registered"; si no, devuelve el pago.`);
      return "registering";
    }
  }

  // 2) registered → DNS en Namecheap + agregar a Vercel.
  if (current.status === "registered") {
    try {
      await bridge("/set-hosts", { domain: current.domain });
      await vercelAttach(current.domain);
      if (await claim(admin, current.id, "registered", "connecting", { attempts: 0, last_error: null })) {
        current = { ...current, status: "connecting", attempts: 0 };
      }
    } catch (err) {
      await bumpAttempt(admin, current, err);
      return current.status;
    }
  }

  // 3) connecting → cuando Vercel lo ve bien, se activa en el catálogo.
  if (current.status === "connecting") {
    try {
      if (!(await vercelReady(current.domain))) {
        await bumpAttempt(admin, current, new Error("Esperando DNS/SSL en Vercel"));
        return current.status;
      }
      if (!(await claim(admin, current.id, "connecting", "active", { activated_at: new Date().toISOString(), attempts: 0, last_error: null }))) {
        return current.status;
      }
      await admin.from("tenants").update({ custom_domain: current.domain }).eq("id", current.tenant_id);
      await notifySlack("🌐 Dominio activo", `*${current.domain}* ya abre el catálogo de ${await tenantLabel(admin, current.tenant_id)} · cobrado $${(current.price_cents / 100).toFixed(2)}/año`);
      return "active";
    } catch (err) {
      await bumpAttempt(admin, current, err);
      return current.status;
    }
  }

  // 4) canceled y vencido → el catálogo vuelve al subdominio.
  if (current.status === "canceled" && current.expires_at && new Date(current.expires_at) < new Date()) {
    if (await claim(admin, current.id, "canceled", "expired")) {
      await admin.from("tenants").update({ custom_domain: null }).eq("id", current.tenant_id).eq("custom_domain", current.domain);
      return "expired";
    }
  }

  return current.status;
}

/** Renovación pagada en Stripe → renovar en Namecheap. */
export async function renewDomain(admin: Admin, row: DomainRow): Promise<void> {
  try {
    const r = await bridge<{ renewed: boolean; expiresAt: string | null }>("/renew", { domain: row.domain, years: 1 });
    const fallback = new Date(row.expires_at ?? Date.now());
    fallback.setFullYear(fallback.getFullYear() + 1);
    const parsed = r.expiresAt ? new Date(r.expiresAt) : null;
    const expires = parsed && !isNaN(parsed.getTime()) ? parsed : fallback;
    await admin.from("tenant_domains").update({ expires_at: expires.toISOString(), last_error: null }).eq("id", row.id);
    await notifySlack("♻️ Dominio renovado", `*${row.domain}* · ${await tenantLabel(admin, row.tenant_id)} · vence ${expires.toISOString().slice(0, 10)}`);
  } catch (err) {
    await admin.from("tenant_domains").update({ last_error: `renovación: ${(err as Error).message}`.slice(0, 1000) }).eq("id", row.id);
    await notifySlack("🚨 Renovación de dominio falló — RENOVAR A MANO", `*${row.domain}* · ${await tenantLabel(admin, row.tenant_id)}\nEl cliente ya pagó. ${(err as Error).message}`);
  }
}

export const DOMAIN_COLUMNS =
  "id, tenant_id, domain, status, years, register_cost_cents, renew_cost_cents, price_cents, stripe_session_id, stripe_subscription_id, provider_order_id, attempts, expires_at";
