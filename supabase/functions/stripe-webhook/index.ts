import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";

const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG",
  "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);
const THREE_DECIMAL = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

function formatStripeAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || !currency) return "—";
  const cur = currency.toUpperCase();
  if (ZERO_DECIMAL.has(cur)) return `${amount.toLocaleString("es-ES")} ${cur}`;
  const divisor = THREE_DECIMAL.has(cur) ? 1000 : 100;
  const value = amount / divisor;
  return `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}

function stripeAmountToNumber(amount: number | null | undefined, currency: string | null | undefined): number {
  if (amount == null || !currency) return 0;
  const cur = currency.toUpperCase();
  if (ZERO_DECIMAL.has(cur)) return amount;
  const divisor = THREE_DECIMAL.has(cur) ? 1000 : 100;
  return amount / divisor;
}

// Convierte el color numérico (0xRRGGBB) de los antiguos embeds de Discord a
// un hex CSS para la barra lateral del attachment de Slack.
function hexColor(color: number): string {
  return "#" + color.toString(16).padStart(6, "0");
}

// Notifica al canal #pagos de Slack. Mantiene la misma firma que el helper
// anterior (title/description/color/fields) para no tocar las llamadas.
// Los `fields` se renderizan en sections de dos columnas (Block Kit soporta
// hasta 10 fields por section, así que se parten en tandas).
async function notifyDiscord(embed: {
  title: string;
  description: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
}): Promise<void> {
  const url = Deno.env.get("SLACK_PAYMENTS_WEBHOOK_URL");
  if (!url) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    { type: "header", text: { type: "plain_text", text: embed.title, emoji: true } },
  ];
  if (embed.description) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: embed.description } });
  }
  const fields = embed.fields ?? [];
  for (let i = 0; i < fields.length; i += 10) {
    blocks.push({
      type: "section",
      fields: fields.slice(i, i + 10).map((f) => ({
        type: "mrkdwn",
        text: `*${f.name}:*\n${f.value}`,
      })),
    });
  }
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `Stripe · CatálogoHoy · ${new Date().toISOString()}` }],
  });

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "CatálogoHoy Payments",
      attachments: [{ color: hexColor(embed.color), blocks }],
    }),
  }).catch(() => {});
}

const CATALOG_ADDON_PRICE_SET = new Set([
  "price_1T6FOP85rys2QLXdBCv2bKYj",
  "price_1T6FeL85rys2QLXdTynF6gvl",
  "price_1T6FeM85rys2QLXd0oiLc2jh",
  "price_1TSKFj85rys2QLXdjTw0rzPf",
  "price_1TSKFj85rys2QLXdWKigiMHd",
  "price_1TSKFj85rys2QLXdAo6dtEpx",
]);

function getCatalogAddonQtyFromSub(sub: Stripe.Subscription): number {
  return sub.items.data.filter((item) => CATALOG_ADDON_PRICE_SET.has(item.price.id))
    .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}

function getSubPeriodEnd(sub: Stripe.Subscription): number | null {
  const items = sub.items?.data ?? [];
  for (const item of items) {
    const cpe = (item as unknown as { current_period_end?: number }).current_period_end;
    if (typeof cpe === "number" && Number.isFinite(cpe)) return cpe;
  }
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  return typeof legacy === "number" && Number.isFinite(legacy) ? legacy : null;
}

function toIsoOrNull(epochSeconds: number | null): string | null {
  if (epochSeconds == null) return null;
  const d = new Date(epochSeconds * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function getInvoiceSubId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | null }).subscription;
  if (typeof legacy === "string" && legacy.startsWith("sub_")) return legacy;
  const parent = (invoice as unknown as { parent?: { subscription_details?: { subscription?: string | null } } }).parent;
  const fromParent = parent?.subscription_details?.subscription;
  return typeof fromParent === "string" && fromParent.startsWith("sub_") ? fromParent : null;
}

// Human, Spanish explanation for Stripe decline / charge-failure codes.
// https://stripe.com/docs/declines/codes
const DECLINE_ES: Record<string, string> = {
  generic_decline: "La tarjeta fue rechazada por el banco (rechazo genérico). El cliente debe contactar a su banco o usar otra tarjeta.",
  insufficient_funds: "Fondos insuficientes en la tarjeta.",
  do_not_honor: "El banco rechazó el cobro (do not honor). El cliente debe contactar a su banco.",
  transaction_not_allowed: "El banco no permite este tipo de transacción.",
  card_declined: "La tarjeta fue rechazada por el banco.",
  expired_card: "La tarjeta está vencida.",
  incorrect_cvc: "El código de seguridad (CVC) es incorrecto.",
  invalid_cvc: "El código de seguridad (CVC) es inválido.",
  incorrect_number: "El número de tarjeta es incorrecto.",
  invalid_expiry_month: "El mes de vencimiento de la tarjeta es inválido.",
  invalid_expiry_year: "El año de vencimiento de la tarjeta es inválido.",
  lost_card: "La tarjeta fue reportada como perdida.",
  stolen_card: "La tarjeta fue reportada como robada.",
  pickup_card: "El banco pidió retener la tarjeta.",
  fraudulent: "El banco marcó el cobro como sospechoso de fraude.",
  merchant_blacklist: "La tarjeta fue rechazada por una lista de bloqueo del banco.",
  card_not_supported: "La tarjeta no soporta este tipo de compra.",
  currency_not_supported: "La tarjeta no soporta esta moneda.",
  processing_error: "Error de procesamiento del banco. Conviene reintentar más tarde.",
  try_again_later: "El banco pidió reintentar más tarde.",
  authentication_required: "El cobro requiere autenticación del banco (3D Secure) que no se completó.",
  approve_with_id: "El banco no pudo identificar al titular. El cliente debe contactar a su banco.",
  call_issuer: "El cliente debe contactar a su banco para autorizar el cobro.",
  card_velocity_exceeded: "Se superó el límite de operaciones de la tarjeta.",
  withdrawal_count_limit_exceeded: "Se superó el límite de operaciones/retiros de la tarjeta.",
  not_permitted: "El banco no permite esta operación.",
  service_not_allowed: "El banco no permite este servicio.",
  no_action_taken: "El banco rechazó el cobro. El cliente debe contactar a su banco.",
  revocation_of_authorization: "El cliente revocó la autorización de cobros recurrentes.",
  test_mode_live_card: "Se usó una tarjeta real en modo de prueba.",
};

function declineReasonEs(code: string | null | undefined): string | null {
  return code && DECLINE_ES[code] ? DECLINE_ES[code] : null;
}

// Generic, unhelpful values Stripe sometimes returns at the PaymentIntent level.
const GENERIC_PI_MESSAGES = new Set(["The payment failed.", "The payment attempt failed."]);
const NOISE_CODES = new Set(["payment_intent_payment_attempt_failed"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fmtPiError(err: any): string | null {
  if (!err) return null;
  const declineCode: string | null = err.decline_code || null;
  // 1) Clear Spanish reason from the decline/error code.
  const friendly = declineReasonEs(declineCode) || declineReasonEs(err.code);
  if (friendly) return declineCode ? `${friendly} (decline_code: ${declineCode})` : friendly;
  // 2) Stripe's own message, unless it's the generic placeholder.
  if (err.message && !GENERIC_PI_MESSAGES.has(err.message)) {
    return declineCode ? `${err.message} (decline_code: ${declineCode})` : err.message;
  }
  // 3) Bare decline code (still actionable).
  if (declineCode) return `La tarjeta fue rechazada por el banco (decline_code: ${declineCode}).`;
  // 4) A meaningful error code — skip the noisy PaymentIntent-level one.
  if (err.code && !NOISE_CODES.has(err.code)) return `Error de Stripe: ${err.code}`;
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fmtChargeReason(charge: any): string | null {
  if (!charge) return null;
  const failureCode: string | null = charge.failure_code || null;
  const friendly = declineReasonEs(failureCode);
  if (friendly) return failureCode ? `${friendly} (code: ${failureCode})` : friendly;
  if (charge.failure_message && !GENERIC_PI_MESSAGES.has(charge.failure_message)) {
    return failureCode ? `${charge.failure_message} (code: ${failureCode})` : charge.failure_message;
  }
  if (charge.outcome?.seller_message) return charge.outcome.seller_message;
  if (failureCode) return `El cobro fue rechazado (code: ${failureCode}).`;
  return null;
}

// Extracts a human-readable decline reason from a failed invoice. Stripe moved
// `invoice.payment_intent` / `invoice.charge` out of the default payload in
// recent API versions (now under `invoice.payments[].payment.*`), so we scan
// every known shape and, as a last resort, retrieve the invoice expanded and the
// PaymentIntent/charge directly. Each lookup is isolated so it can never throw.
async function getInvoiceFailureReason(stripe: Stripe, invoice: Stripe.Invoice, admin: ReturnType<typeof createClient>): Promise<string> {
  const piIds = new Set<string>();
  const chargeIds = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scan = (inv: any): string | null => {
    if (!inv) return null;
    const dpi = inv.payment_intent;
    if (typeof dpi === "string" && dpi.startsWith("pi_")) piIds.add(dpi);
    else if (dpi && typeof dpi === "object") {
      const r = fmtPiError(dpi.last_payment_error);
      if (r) return r;
      if (typeof dpi.id === "string") piIds.add(dpi.id);
      if (typeof dpi.latest_charge === "string") chargeIds.add(dpi.latest_charge);
    }
    const dch = inv.charge;
    if (typeof dch === "string" && (dch.startsWith("ch_") || dch.startsWith("py_"))) chargeIds.add(dch);
    else if (dch && typeof dch === "object") {
      const r = fmtChargeReason(dch);
      if (r) return r;
    }
    for (const p of inv.payments?.data ?? []) {
      const pi = p?.payment?.payment_intent;
      if (typeof pi === "string" && pi.startsWith("pi_")) piIds.add(pi);
      else if (pi && typeof pi === "object") {
        const r = fmtPiError(pi.last_payment_error);
        if (r) return r;
        if (typeof pi.id === "string") piIds.add(pi.id);
        if (typeof pi.latest_charge === "string") chargeIds.add(pi.latest_charge);
      }
      const ch = p?.payment?.charge;
      if (typeof ch === "string" && (ch.startsWith("ch_") || ch.startsWith("py_"))) chargeIds.add(ch);
      else if (ch && typeof ch === "object") {
        const r = fmtChargeReason(ch);
        if (r) return r;
      }
    }
    return null;
  };

  let inline = scan(invoice);
  if (inline) return inline;

  // Nothing usable inline — retrieve the invoice expanded.
  if (piIds.size === 0 && chargeIds.size === 0 && invoice?.id) {
    try {
      const full = await stripe.invoices.retrieve(invoice.id, {
        expand: ["payments.data.payment.payment_intent", "payments.data.payment.charge", "payment_intent", "charge"],
      });
      inline = scan(full);
      if (inline) return inline;
    } catch { /* ignore */ }
  }

  for (const piId of piIds) {
    try {
      const pi = await stripe.paymentIntents.retrieve(piId);
      const r = fmtPiError(pi.last_payment_error);
      if (r) return r;
      if (typeof pi.latest_charge === "string") chargeIds.add(pi.latest_charge);
    } catch { /* ignore */ }
  }
  for (const chId of chargeIds) {
    try {
      const charge = await stripe.charges.retrieve(chId);
      const r = fmtChargeReason(charge);
      if (r) return r;
    } catch { /* ignore */ }
  }
  if (invoice.last_finalization_error?.message) return invoice.last_finalization_error.message;

  // Couldn't resolve it — log the shape so the next failure is diagnosable.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inv = invoice as any;
    await logDebug(admin, `failure reason unresolved for invoice ${invoice.id}: keys=[${Object.keys(inv).join(",")}] payment_intent=${typeof inv.payment_intent} charge=${typeof inv.charge} payments=${inv.payments ? (inv.payments.data?.length ?? 0) : "none"}`);
  } catch { /* noop */ }
  return "—";
}

async function logDebug(admin: ReturnType<typeof createClient>, msg: string): Promise<void> {
  try {
    await admin.from("_debug_logs").insert({ fn_name: "stripe-webhook", message: msg });
  } catch { /* noop */ }
}

function escape(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function emailShell(opts: {
  title: string; headlineColor: string; headline: string; greetingName: string | null; body: string;
  rows: Array<{ label: string; value: string }>; ctaLabel: string; ctaUrl: string; themeColor: string;
  logo: string | null; brandName: string;
}): string {
  const themeColor = opts.themeColor || "#10b981";
  const headerInner = opts.logo
    ? `<img src="${escape(opts.logo)}" alt="${escape(opts.brandName)}" width="56" height="56" style="display:inline-block;border-radius:50%;border:3px solid #ffffff;background:#ffffff;" />`
    : `<div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:#ffffff33;line-height:56px;font-weight:700;font-size:22px;color:#ffffff;">${escape(opts.brandName.charAt(0))}</div>`;
  const greeting = opts.greetingName ? `Hola ${escape(opts.greetingName.split(" ")[0])},` : "Hola,";
  const rowsHtml = opts.rows.map((r) => `<tr><td style="padding:6px 0;font-size:13px;color:#94a3b8;">${escape(r.label)}</td><td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:600;text-align:right;">${escape(r.value)}</td></tr>`).join("");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${escape(opts.title)}</title></head><body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',-apple-system,sans-serif;color:#1e293b;"><table cellspacing="0" cellpadding="0" width="100%" style="background:#f8fafc;padding:24px 12px;"><tr><td align="center"><table cellspacing="0" cellpadding="0" width="600" style="max-width:100%;background:#fff;border-radius:16px;overflow:hidden;"><tr><td style="background:${themeColor};padding:32px 24px;text-align:center;">${headerInner}<h1 style="margin:16px 0 4px;font-size:18px;font-weight:700;color:#fff;">${escape(opts.brandName)}</h1><p style="margin:0;font-size:13px;color:#ffffffcc;">CatalogoHoy</p></td></tr><tr><td style="padding:32px 24px;"><div style="background:${opts.headlineColor}1A;border-left:4px solid ${opts.headlineColor};border-radius:8px;padding:14px 16px;margin-bottom:24px;"><p style="margin:0;font-size:18px;font-weight:700;color:${opts.headlineColor};">${escape(opts.headline)}</p></div><p style="margin:0 0 12px;font-size:15px;">${greeting}</p><p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">${escape(opts.body)}</p><div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:24px;"><table cellspacing="0" cellpadding="0" width="100%">${rowsHtml}</table></div><div style="text-align:center;margin:24px 0 8px;"><a href="${escape(opts.ctaUrl)}" style="display:inline-block;background:${themeColor};color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px;">${escape(opts.ctaLabel)} →</a></div></td></tr><tr><td style="padding:20px 24px;text-align:center;background:#f8fafc;border-top:1px solid #f1f5f9;"><p style="margin:0;font-size:11px;color:#94a3b8;">Recibiste este email porque sos dueño del catálogo <strong>${escape(opts.brandName)}</strong>.<br>CatalogoHoy · <a href="https://catalogohoy.com" style="color:#94a3b8;">catalogohoy.com</a></p></td></tr></table></td></tr></table></body></html>`;
}

interface OwnerInfo {
  email: string | null; name: string | null; tenantName: string; slug: string;
  customDomain: string | null; logo: string | null; themeColor: string; planId: string | null;
}

async function fetchOwnerInfo(admin: ReturnType<typeof createClient>, tenantId: number): Promise<OwnerInfo | null> {
  const [tenantResp, cfgResp, linkResp] = await Promise.all([
    admin.from("tenants").select("name, slug, custom_domain, plan_id").eq("id", tenantId).maybeSingle(),
    admin.from("tenant_ecommerce_config").select("logo, theme_color").eq("tenant_id", tenantId).maybeSingle(),
    admin.from("users_tenants").select("users!inner(name, last_name, email)").eq("tenant_id", tenantId).eq("role", "owner").maybeSingle(),
  ]);
  if (!tenantResp.data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = tenantResp.data as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = (cfgResp.data ?? null) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = (linkResp.data as any)?.users ?? null;
  const email = (user?.email ?? "").trim();
  const name = [user?.name, user?.last_name].filter(Boolean).join(" ").trim() || null;
  return {
    email: email && email.includes("@") ? email : null,
    name,
    tenantName: tenant.name ?? `Tenant #${tenantId}`,
    slug: tenant.slug ?? String(tenantId),
    customDomain: tenant.custom_domain ?? null,
    logo: cfg?.logo ?? null,
    themeColor: cfg?.theme_color ?? "#10b981",
    planId: tenant.plan_id ?? null,
  };
}

// --- Email (AWS SES principal, con fallback a MailerSend/Resend) --------------
// El switch es por presencia de secret: AWS_SES_ACCESS_KEY_ID (SES) tiene
// prioridad; si no, MailerSend; si no, Resend.
function hasEmailProvider(): boolean {
  return !!(Deno.env.get("AWS_SES_ACCESS_KEY_ID") || Deno.env.get("MAILER_SEND_API_KEY") || Deno.env.get("RESEND_API_KEY"));
}

// Envío por AWS SES (v2 SendEmail, firma SigV4 con aws4fetch). Proveedor
// principal: se activa por presencia de AWS_SES_ACCESS_KEY_ID (prioridad sobre
// MailerSend/Resend). Región sa-east-1, config set catalogohoy-prod.
async function sendViaSes(
  to: string[],
  fromName: string,
  fromEmail: string,
  subject: string,
  html: string,
  text?: string,
): Promise<{ ok: boolean; id: string | null; status: number; error?: string }> {
  const region = Deno.env.get("AWS_SES_REGION") ?? "sa-east-1";
  const aws = new AwsClient({
    accessKeyId: Deno.env.get("AWS_SES_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SES_SECRET_ACCESS_KEY")!,
    region,
    service: "ses",
  });
  const res = await aws.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      FromEmailAddress: `${fromName} <${fromEmail}>`,
      Destination: { ToAddresses: to },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            ...(text ? { Text: { Data: text, Charset: "UTF-8" } } : {}),
          },
        },
      },
      ConfigurationSetName: "catalogohoy-prod",
    }),
  });
  if (!res.ok) return { ok: false, id: null, status: res.status, error: await res.text().catch(() => "") };
  const j = await res.json().catch(() => null);
  return { ok: true, id: (j as { MessageId?: string } | null)?.MessageId ?? null, status: res.status };
}

async function deliverEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
}): Promise<{ ok: boolean; id: string | null; status: number; error?: string }> {
  const to = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter((e) => e && e.includes("@"));
  if (to.length === 0) return { ok: false, id: null, status: 0, error: "no recipients" };
  const fromName = opts.fromName ?? "CatalogoHoy";
  const fromEmail = opts.fromEmail ?? "noreply@catalogohoy.com";

  // AWS SES primero (proveedor principal desde la migración desde Resend).
  if (Deno.env.get("AWS_SES_ACCESS_KEY_ID") && Deno.env.get("AWS_SES_SECRET_ACCESS_KEY")) {
    return await sendViaSes(to, fromName, fromEmail, opts.subject, opts.html, opts.text);
  }

  const msToken = Deno.env.get("MAILER_SEND_API_KEY");
  if (msToken) {
    const res = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${msToken}`,
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        from: { email: fromEmail, name: fromName },
        to: to.map((email) => ({ email })),
        subject: opts.subject,
        html: opts.html,
        ...(opts.text ? { text: opts.text } : {}),
      }),
    });
    const id = res.headers.get("x-message-id");
    if (!res.ok) return { ok: false, id, status: res.status, error: await res.text().catch(() => "") };
    return { ok: true, id, status: res.status };
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject: opts.subject,
        html: opts.html,
        ...(opts.text ? { text: opts.text } : {}),
      }),
    });
    if (!res.ok) return { ok: false, id: null, status: res.status, error: await res.text().catch(() => "") };
    const j = await res.json().catch(() => null);
    return { ok: true, id: (j as { id?: string } | null)?.id ?? null, status: res.status };
  }

  return { ok: false, id: null, status: 0, error: "No email provider (AWS_SES / MAILER_SEND_API_KEY / RESEND_API_KEY)" };
}

async function sendResendEmail(admin: ReturnType<typeof createClient>, to: string, subject: string, html: string, text: string): Promise<void> {
  if (!hasEmailProvider()) { await logDebug(admin, "No email provider configured — email skipped"); return; }
  const r = await deliverEmail({ to, subject, html, text });
  if (!r.ok) { await logDebug(admin, `Email ${r.status} for ${to}: ${r.error ?? ""}`); }
}

function adminUrlFor(owner: OwnerInfo): string {
  const host = owner.customDomain ?? `${owner.slug}.catalogohoy.com`;
  return `https://${host}/admin/plans`;
}

function planLabel(planId: string | null | undefined): string {
  if (!planId) return "—";
  return planId.charAt(0).toUpperCase() + planId.slice(1);
}

async function emailPaymentSucceeded(admin: ReturnType<typeof createClient>, owner: OwnerInfo, kind: "new" | "renewal" | "change", amountStr: string, validUntil: string, planLbl: string): Promise<void> {
  if (!owner.email) return;
  const subject = kind === "renewal" ? `Renovación exitosa · Plan ${planLbl} — CatalogoHoy` : kind === "change" ? `Plan actualizado a ${planLbl} — CatalogoHoy` : `Plan ${planLbl} activado — CatalogoHoy`;
  const headline = kind === "renewal" ? "¡Renovación cobrada!" : kind === "change" ? "¡Plan actualizado!" : "¡Plan activado!";
  const body = kind === "renewal" ? "Tu suscripción se renovó automáticamente. Tu catálogo sigue activo." : kind === "change" ? `Cambiaste exitosamente al plan ${planLbl}.` : `Tu plan ${planLbl} fue activado correctamente. Gracias por confiar en CatalogoHoy.`;
  const html = emailShell({ title: subject, headlineColor: "#10b981", headline, greetingName: owner.name, body, rows: [{ label: "Catálogo", value: owner.tenantName }, { label: "Plan", value: planLbl }, { label: "Monto cobrado", value: amountStr }, { label: "Válido hasta", value: validUntil }], ctaLabel: "Ver mi plan", ctaUrl: adminUrlFor(owner), themeColor: owner.themeColor, logo: owner.logo, brandName: owner.tenantName });
  const text = [headline, "", body, "", `Catálogo: ${owner.tenantName}`, `Plan: ${planLbl}`, `Monto: ${amountStr}`, `Válido hasta: ${validUntil}`, "", `Ver mi plan: ${adminUrlFor(owner)}`].join("\n");
  await sendResendEmail(admin, owner.email, subject, html, text);
}

async function emailPaymentFailed(admin: ReturnType<typeof createClient>, owner: OwnerInfo, amountStr: string, attempt: number, nextAttempt: string | null, reason: string, planLbl: string): Promise<void> {
  if (!owner.email) return;
  const subject = `Cobro fallido · ${owner.tenantName} — CatalogoHoy`;
  const headline = "No pudimos cobrar tu suscripción";
  const body = nextAttempt ? `Stripe intentó cobrar la renovación de tu plan ${planLbl} pero el pago fue rechazado. Vamos a reintentar automáticamente el ${nextAttempt}. Actualizá tu método de pago.` : `Stripe intentó cobrar la renovación de tu plan ${planLbl} pero el pago fue rechazado y ya no hay más reintentos. Actualizá tu método de pago para no perder tu plan.`;
  const html = emailShell({ title: subject, headlineColor: "#dc2626", headline, greetingName: owner.name, body, rows: [{ label: "Catálogo", value: owner.tenantName }, { label: "Plan", value: planLbl }, { label: "Monto pendiente", value: amountStr }, { label: "Intento N°", value: String(attempt) }, { label: "Próximo intento", value: nextAttempt ?? "Sin reintento programado" }, { label: "Motivo", value: reason }], ctaLabel: "Actualizar método de pago", ctaUrl: adminUrlFor(owner), themeColor: owner.themeColor, logo: owner.logo, brandName: owner.tenantName });
  const text = [headline, "", body, "", `Catálogo: ${owner.tenantName}`, `Plan: ${planLbl}`, `Monto pendiente: ${amountStr}`, `Intento N°: ${attempt}`, `Próximo intento: ${nextAttempt ?? "Sin reintento programado"}`, `Motivo: ${reason}`, "", `Actualizar método de pago: ${adminUrlFor(owner)}`].join("\n");
  await sendResendEmail(admin, owner.email, subject, html, text);
}

// WhatsApp de billing (template payment_failed, aprobado en la WABA de la
// plataforma): variables [nombre, plan] + botón URL cuyo parámetro es el slug
// (base fija catalogohoy.com/r/plan/{{1}}). Best-effort: jamás rompe el webhook.
async function sendWhatsAppPaymentFailed(admin: ReturnType<typeof createClient>, tenantId: number, owner: OwnerInfo | null): Promise<void> {
  try {
    const waSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
    if (!waSecret || !owner) return;
    const { data: recipient } = await admin.rpc("resolve_billing_wa_recipient", { p_tenant_id: tenantId, p_type: "payment_failed" });
    if (!recipient) return;
    const firstName = (owner.name ?? "").trim().split(" ")[0] || owner.tenantName;
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": waSecret },
      body: JSON.stringify({
        tenantId,
        to: recipient,
        templateType: "payment_failed",
        variables: [firstName, planLabel(owner.planId)],
        urlButtonParam: owner.slug,
      }),
    });
  } catch (err) {
    await logDebug(admin, `whatsapp payment_failed error: ${(err as Error).message}`);
  }
}

async function applyPlanUpdate(admin: ReturnType<typeof createClient>, primaryTenantId: number, full: Record<string, unknown>, shared: Record<string, unknown>): Promise<void> {
  await admin.from("tenants").update(full).eq("id", primaryTenantId);
  const { data: ownerLink } = await admin.from("users_tenants").select("user_id").eq("tenant_id", primaryTenantId).eq("role", "owner").maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerUserId = (ownerLink as any)?.user_id ?? null;
  if (!ownerUserId) return;
  const { data: siblings } = await admin.from("users_tenants").select("tenant_id").eq("user_id", ownerUserId).eq("role", "owner").neq("tenant_id", primaryTenantId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const siblingIds = (siblings ?? []).map((r: any) => r.tenant_id).filter((id: number) => id !== primaryTenantId);
  if (siblingIds.length === 0) return;
  await admin.from("tenants").update(shared).in("id", siblingIds);
}

// ─── Referral reward ─────────────────────────────────────────────────
// Llamado tras el primer pago exitoso de un tenant que vino por programa
// de referidos. La RPC apply_referral_reward acredita el balance interno
// del referrer; aquí además creamos la balance_transaction en Stripe si
// el referrer tiene customer (para que el descuento se aplique solo en su
// próxima factura). Si no tiene Stripe customer (paga manual), el balance
// queda solo en tenants.referral_credit_usd y se consume vía apps/internal.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ReferralRewardResult { status: string; fraud_flag?: string | null; referral_id?: number; referrer_tenant_id?: number; referrer_slug?: string; referrer_name?: string; referrer_email?: string; referrer_stripe_customer_id?: string | null; referrer_credit_usd_awarded?: number; referred_tenant_id?: number; referred_slug?: string; referred_name?: string; referred_email?: string; }

async function maybeApplyReferralReward(
  admin: ReturnType<typeof createClient>,
  stripe: Stripe,
  referredTenantId: number,
  paidAmountUsd: number,
  paymentMethod: "stripe" | "pago_movil"
): Promise<ReferralRewardResult | null> {
  const { data, error } = await admin.rpc("apply_referral_reward", {
    p_referred_tenant_id: referredTenantId,
    p_paid_amount_usd: paidAmountUsd,
    p_payment_method: paymentMethod,
  });
  if (error) {
    await logDebug(admin, `apply_referral_reward error: ${error.message}`);
    return null;
  }
  if (!data) return null;
  const result = data as ReferralRewardResult;

  // Si fue rewarded y pagó por Stripe, aplicar balance_transaction al referrer
  // para que su próxima factura tenga el crédito descontado automáticamente.
  if (paymentMethod === "stripe" && result.status === "rewarded" && result.referrer_stripe_customer_id) {
    const awarded = result.referrer_credit_usd_awarded ?? 0;
    try {
      const balanceTx = await stripe.customers.createBalanceTransaction(
        result.referrer_stripe_customer_id,
        {
          amount: -1 * Math.round(awarded * 100),
          currency: "usd",
          description: `Referral reward por ${result.referred_email ?? result.referred_slug ?? "-"}`,
        }
      );
      if (result.referral_id) {
        await admin.from("referrals").update({ referrer_stripe_balance_tx: balanceTx.id }).eq("id", result.referral_id);
      }
    } catch (err) {
      await logDebug(admin, `stripe balance tx failed: ${(err as Error).message}`);
    }
  }
  return result;
}

Deno.serve(async (req: Request) => {
  const sig  = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    if (event.type === "checkout.session.completed") {
      const session     = event.data.object as Stripe.Checkout.Session;
      const tenantId    = session.metadata?.tenant_id;
      const sessionType = session.metadata?.type;
      const newSubId    = session.subscription as string | null;

      if (!tenantId) return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });

      if (sessionType === "catalog_addon" && newSubId) {
        const { data: tenantRow } = await admin.from("tenants").select("extra_catalogs, name, slug").eq("id", Number(tenantId)).single();
        const newCount = (tenantRow?.extra_catalogs ?? 0) + 1;
        await admin.from("tenants").update({ extra_catalogs: newCount }).eq("id", Number(tenantId));
        const amountStr = formatStripeAmount(session.amount_total, session.currency);
        await notifyDiscord({
          title: "📂 Catálogo adicional activado",
          description: `**${tenantRow?.name ?? `Tenant #${tenantId}`}** ha activado un catálogo adicional.`,
          color: 0x8b5cf6,
          fields: [
            { name: "Catálogos extras", value: String(newCount), inline: true },
            { name: "Monto", value: amountStr, inline: true },
            { name: "Slug", value: tenantRow?.slug ?? String(tenantId), inline: true },
          ],
        });
        return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
      }

      const planId        = session.metadata?.plan_id;
      const previousSubId = session.metadata?.previous_subscription_id;
      const addonQty      = parseInt(session.metadata?.catalog_addon_quantity ?? "0", 10);

      if (planId && newSubId) {
        const subscription = await stripe.subscriptions.retrieve(newSubId);
        const periodEnd    = getSubPeriodEnd(subscription);
        const expiresAtIso = toIsoOrNull(periodEnd);
        if (!expiresAtIso) await logDebug(admin, `checkout.session.completed: missing period end for sub ${newSubId} (tenant ${tenantId})`);

        const fullUpdate: Record<string, unknown> = {
          plan_id: planId,
          plan_started_at: new Date().toISOString(),
          plan_expired: false,
          stripe_subscription_id: newSubId,
          stripe_subscription_status: subscription.status,
        };
        if (expiresAtIso) fullUpdate["plan_expires_at"] = expiresAtIso;
        if (addonQty > 0) {
          const qtyFromSub = getCatalogAddonQtyFromSub(subscription);
          fullUpdate["extra_catalogs"] = qtyFromSub > 0 ? qtyFromSub : addonQty;
        }

        const sharedUpdate: Record<string, unknown> = {
          plan_id: planId, plan_expired: false, stripe_subscription_status: subscription.status,
        };
        if (expiresAtIso) sharedUpdate["plan_expires_at"] = expiresAtIso;

        await applyPlanUpdate(admin, Number(tenantId), fullUpdate, sharedUpdate);

        if (previousSubId && previousSubId !== newSubId) {
          await stripe.subscriptions.cancel(previousSubId).catch(() => {});
        }

        const planLbl   = planLabel(planId);
        const amountStr = formatStripeAmount(session.amount_total, session.currency);
        const paidAmountUsd = stripeAmountToNumber(session.amount_total, session.currency);
        const validUntilStr = expiresAtIso ? new Date(expiresAtIso).toLocaleDateString("es-ES") : "—";
        const isPlanChange = !!previousSubId;

        const owner = await fetchOwnerInfo(admin, Number(tenantId));
        const tenantName = owner?.tenantName ?? `Tenant #${tenantId}`;
        const slug = owner?.slug ?? String(tenantId);

        // Solo aplicar referral reward en primer pago (no upgrades).
        let referral: ReferralRewardResult | null = null;
        if (!isPlanChange) {
          referral = await maybeApplyReferralReward(admin, stripe, Number(tenantId), paidAmountUsd, "stripe");
        }

        const fields: { name: string; value: string; inline?: boolean }[] = [
          { name: "Plan",         value: planLbl,    inline: true },
          { name: "Monto",        value: amountStr,  inline: true },
          { name: "Suscripción",  value: newSubId,   inline: false },
          { name: "Válido hasta", value: validUntilStr, inline: true },
          { name: "Slug",         value: slug,       inline: true },
        ];
        if (addonQty > 0) {
          fields.push({ name: "Catálogos extra", value: `✅ ${addonQty} incluido${addonQty > 1 ? "s" : ""}`, inline: true });
        }
        if (referral && referral.status === "rewarded") {
          fields.push({ name: "🎁 Referido por", value: `${referral.referrer_name ?? referral.referrer_slug} (${referral.referrer_email ?? "-"})`, inline: false });
          fields.push({ name: "Reward al referente", value: `$${referral.referrer_credit_usd_awarded ?? 0}`, inline: true });
        } else if (referral && referral.status === "expired") {
          fields.push({ name: "⚠️ Referral flagged", value: referral.fraud_flag ?? "unknown", inline: false });
        }

        await notifyDiscord({
          title: isPlanChange ? "🔄 Plan cambiado" : "💰 Nuevo pago recibido",
          description: isPlanChange ? `**${tenantName}** ha cambiado al plan **${planLbl}**.` : `**${tenantName}** ha activado el plan **${planLbl}**.`,
          color: isPlanChange ? 0x6366f1 : 0x22c55e,
          fields,
        });

        if (owner) await emailPaymentSucceeded(admin, owner, isPlanChange ? "change" : "new", amountStr, validUntilStr, planLbl);
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub      = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenant_id;
      const subType  = sub.metadata?.type;
      if (tenantId && subType !== "catalog_addon") {
        const periodEnd  = getSubPeriodEnd(sub);
        const expiresAtIso = toIsoOrNull(periodEnd);
        // A subscription only confers validity once it has actually been paid.
        // Statuses that never had a successful payment (incomplete /
        // incomplete_expired) must NOT write a future plan_expires_at — that left
        // free tenants looking "valid until" a date they never paid for.
        const VALID_STATUSES = new Set(["active", "trialing", "past_due"]);
        const isValid    = VALID_STATUSES.has(sub.status);
        const isExpired  = sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired";
        const catalogQty = getCatalogAddonQtyFromSub(sub);
        const fullUpdate: Record<string, unknown> = { plan_expired: isExpired, stripe_subscription_status: sub.status, extra_catalogs: catalogQty };
        const sharedUpdate: Record<string, unknown> = { plan_expired: isExpired, stripe_subscription_status: sub.status };
        if (expiresAtIso && isValid) {
          fullUpdate["plan_expires_at"] = expiresAtIso;
          sharedUpdate["plan_expires_at"] = expiresAtIso;
        } else if (!expiresAtIso) {
          await logDebug(admin, `customer.subscription.updated: missing period end for sub ${sub.id} (tenant ${tenantId})`);
        }
        // Upgrade con prorrateo (edge fn `change-plan`): al cambiar el precio del
        // ítem, la suscripción sigue viva pero pasa a otro plan. Reflejamos el
        // nuevo plan_id desde el metadata de la suscripción (que `change-plan`
        // deja sincronizado). Solo con estado válido, para no "ascender" a un
        // tenant cuya sub quedó impaga.
        const metaPlanId = sub.metadata?.plan_id;
        if (metaPlanId && isValid) {
          fullUpdate["plan_id"] = metaPlanId;
          sharedUpdate["plan_id"] = metaPlanId;
        }
        await applyPlanUpdate(admin, Number(tenantId), fullUpdate, sharedUpdate);
        const { data: tenant } = await admin.from("tenants").select("name, slug").eq("id", Number(tenantId)).single();
        await notifyDiscord({
          title: "🔄 Suscripción actualizada",
          description: `La suscripción de **${tenant?.name ?? `Tenant #${tenantId}`}** ha cambiado.`,
          color: 0x6366f1,
          fields: [
            { name: "Estado", value: sub.status, inline: true },
            { name: "Catálogos extra", value: String(catalogQty), inline: true },
            { name: "Válido hasta", value: (expiresAtIso && isValid) ? new Date(expiresAtIso).toLocaleDateString("es-ES") : "—", inline: true },
            { name: "Slug", value: tenant?.slug ?? String(tenantId), inline: true },
          ],
        });
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const billingReason = invoice.billing_reason;
      if (billingReason !== "subscription_cycle" && billingReason !== "subscription_update") {
        return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
      }
      const subscriptionId = getInvoiceSubId(invoice);
      if (!subscriptionId) { await logDebug(admin, `invoice.payment_succeeded: no subscription id on invoice ${invoice.id}`); return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } }); }
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const tenantId = sub.metadata?.tenant_id;
      if (!tenantId) return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
      const periodEnd  = getSubPeriodEnd(sub);
      const expiresAtIso = toIsoOrNull(periodEnd);
      if (expiresAtIso) {
        const sharedUpdate: Record<string, unknown> = { plan_expires_at: expiresAtIso, plan_expired: false, stripe_subscription_status: sub.status };
        await applyPlanUpdate(admin, Number(tenantId), sharedUpdate, sharedUpdate);
      }
      const owner = await fetchOwnerInfo(admin, Number(tenantId));
      const tenantName = owner?.tenantName ?? `Tenant #${tenantId}`;
      const slug = owner?.slug ?? String(tenantId);
      const planLbl = planLabel(owner?.planId);
      const amountStr = formatStripeAmount(invoice.amount_paid, invoice.currency);
      const periodEndStr = expiresAtIso ? new Date(expiresAtIso).toLocaleDateString("es-ES") : "—";
      await notifyDiscord({
        title: "♻️ Renovación cobrada",
        description: `Stripe cobró automáticamente la renovación de **${tenantName}**.`,
        color: 0x22c55e,
        fields: [
          { name: "Plan", value: planLbl, inline: true },
          { name: "Monto", value: amountStr, inline: true },
          { name: "Próxima renovación", value: periodEndStr, inline: true },
          { name: "Slug", value: slug, inline: true },
          { name: "Suscripción", value: subscriptionId, inline: false },
        ],
      });
      if (owner) await emailPaymentSucceeded(admin, owner, "renewal", amountStr, periodEndStr, planLbl);
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubId(invoice);
      if (!subscriptionId) return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const tenantId = sub.metadata?.tenant_id;
      if (!tenantId) return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
      const statusUpdate: Record<string, unknown> = { stripe_subscription_status: sub.status };
      await applyPlanUpdate(admin, Number(tenantId), statusUpdate, statusUpdate);
      const owner = await fetchOwnerInfo(admin, Number(tenantId));
      const tenantName = owner?.tenantName ?? `Tenant #${tenantId}`;
      const slug = owner?.slug ?? String(tenantId);
      const planLbl = planLabel(owner?.planId);
      const amountStr = formatStripeAmount(invoice.amount_due, invoice.currency);
      const attempt = invoice.attempt_count ?? 1;
      const nextAttemptStr = invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : null;
      const reason = await getInvoiceFailureReason(stripe, invoice, admin);
      await notifyDiscord({
        title: "⚠️ Cobro fallido",
        description: `Stripe NO pudo cobrar la renovación de **${tenantName}**. ${nextAttemptStr ? "Reintentará automáticamente." : "No hay más reintentos programados."}`,
        color: 0xef4444,
        fields: [
          { name: "Plan", value: planLbl, inline: true },
          { name: "Monto pendiente", value: amountStr, inline: true },
          { name: "Estado sub", value: sub.status, inline: true },
          { name: "Intento N°", value: String(attempt), inline: true },
          { name: "Próximo intento", value: nextAttemptStr ?? "sin reintento programado", inline: true },
          { name: "Slug", value: slug, inline: true },
          { name: "Motivo Stripe", value: reason, inline: false },
          { name: "Suscripción", value: subscriptionId, inline: false },
        ],
      });
      if (owner) await emailPaymentFailed(admin, owner, amountStr, attempt, nextAttemptStr, reason, planLbl);
      await sendWhatsAppPaymentFailed(admin, Number(tenantId), owner);
    }

    if (event.type === "customer.subscription.deleted") {
      const sub      = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenant_id;
      const subType  = sub.metadata?.type;
      if (!tenantId) return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
      if (subType === "catalog_addon") {
        const { data: tenantRow } = await admin.from("tenants").select("extra_catalogs, name, slug").eq("id", Number(tenantId)).single();
        const newCount = Math.max(0, (tenantRow?.extra_catalogs ?? 0) - 1);
        await admin.from("tenants").update({ extra_catalogs: newCount }).eq("id", Number(tenantId));
        await notifyDiscord({
          title: "📂 Catálogo adicional cancelado",
          description: `Se canceló un catálogo adicional de **${tenantRow?.name ?? `Tenant #${tenantId}`}**.`,
          color: 0xef4444,
          fields: [
            { name: "Catálogos extras restantes", value: String(newCount), inline: true },
            { name: "Slug", value: tenantRow?.slug ?? String(tenantId), inline: true },
          ],
        });
        return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
      }
      const { data: tenantRow } = await admin.from("tenants").select("stripe_subscription_id, name, slug, plan_id").eq("id", Number(tenantId)).single();
      if (tenantRow?.stripe_subscription_id === sub.id) {
        // Churn real: cuando Stripe BORRA la suscripción (cancelación inmediata o
        // fin de período de un cancel_at_period_end), no basta con marcar
        // plan_expired: bajamos el plan a 'gratis' y guardamos el plan pago que
        // tenían en previous_plan_id (para reactivar y para que el interno lo
        // clasifique como churn, no como pago vigente). También limpiamos
        // plan_expires_at porque 'gratis' no tiene vencimiento.
        // El guard `stripe_subscription_id === sub.id` evita que esto dispare en
        // upgrades: ahí el sub viejo se cancela pero el tenant ya apunta al nuevo.
        const currentPlan = (tenantRow as { plan_id?: string | null }).plan_id ?? null;
        const wasPaid = !!currentPlan && currentPlan !== "gratis";
        const fullUpdate: Record<string, unknown> = { plan_id: "gratis", plan_expired: true, plan_expires_at: null, stripe_subscription_status: "canceled", extra_catalogs: 0 };
        const sharedUpdate: Record<string, unknown> = { plan_id: "gratis", plan_expired: true, plan_expires_at: null, stripe_subscription_status: "canceled" };
        if (wasPaid) {
          fullUpdate["previous_plan_id"] = currentPlan;
          sharedUpdate["previous_plan_id"] = currentPlan;
        }
        await applyPlanUpdate(admin, Number(tenantId), fullUpdate, sharedUpdate);
        await notifyDiscord({
          title: "❌ Suscripción cancelada",
          description: `La suscripción de **${tenantRow?.name ?? `Tenant #${tenantId}`}** ha sido cancelada.${wasPaid ? ` Plan bajado a gratis (antes: ${planLabel(currentPlan)}).` : ""}`,
          color: 0xef4444,
          fields: [
            { name: "Slug", value: tenantRow?.slug ?? String(tenantId), inline: true },
            { name: "Plan anterior", value: wasPaid ? planLabel(currentPlan) : "—", inline: true },
          ],
        });
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    await logDebug(admin, `Unhandled error on event ${event.type} (${event.id}): ${msg}`);
    return new Response(JSON.stringify({ received: true, logged_error: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});

void stripeAmountToNumber;
