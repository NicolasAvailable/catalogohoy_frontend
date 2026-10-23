import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";

// =============================================================================
// send-credit-reminders — CAT-79: recordatorios de cobranza de órdenes a
// crédito. Cron diario (12:00 UTC = 08:00 VE): escanea orders.status='credit',
// detecta las vencidas (cuota impaga con fecha pasada, o antigüedad > umbral
// del dueño cuando no hay cuotas), y manda al dueño UN email por tienda (AWS
// SES, mismo shell branded que send-low-stock-alerts) + push best-effort via
// send-push-notification. Anti-spam: marca orders.credit_reminded_at y no
// repite la misma orden por REMIND_COOLDOWN_DAYS. Respeta
// users.notify_credit_reminders y users.credit_reminder_days.
// State-driven (sin tabla cola, a diferencia de low_stock_alerts): el estado
// vivo de la orden ES la fuente; si se cobra (status→completed) sale sola.
// Auth: header x-webhook-secret (mismo patrón que los demás cron jobs).
// =============================================================================

const CRON_SECRET = "whsec_credit_5d1c9a7e3b8f2064ca97e1b4d6f08a23";
const FROM_NAME = "CatalogoHoy";
const FROM_EMAIL = "noreply@catalogohoy.com";
/** Días sin repetir el recordatorio de una misma orden. */
const REMIND_COOLDOWN_DAYS = 7;
/** Tope de filas en el email (el resto se resume como "y N más"). */
const MAX_ROWS = 10;

function escape(input) {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Mismo shell branded que stripe-webhook / send-low-stock-alerts.
// --- Layout de marca de emails ----------------------------------------------
// Mismo diseño que las plantillas de Supabase Auth (reset de contraseña, etc.):
// fondo #eaf1ff, card blanca con radio 12px, logo, título #16367f, texto
// #383838 en Arial y botón #3e7bfa con radio 8px. Copia idéntica en cada
// función que manda email: si cambiás algo acá, cambialo en todas.
const BRAND_LOGO_URL = "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/catalogohoy-logo.png";
const BRAND_BLUE = "#3e7bfa";
function brandEsc(v) {
  if (v == null) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
// Botón principal (azul lleno) o secundario (borde azul).
function brandButton(b) {
  const style = b.secondary
    ? `background-color:#ffffff;color:${BRAND_BLUE};border:2px solid ${BRAND_BLUE};padding:12px 24px;`
    : `background-color:${BRAND_BLUE};color:#ffffff;padding:14px 26px;`;
  return `<a href="${brandEsc(b.url)}" style="${style}text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;margin:4px;">${brandEsc(b.label)}</a>`;
}
// Bloque de datos "etiqueta → valor" en caja celeste (para resúmenes).
function brandRows(rows) {
  const trs = rows.map((r, i) => `<tr><td style="padding:10px 0;font-size:14px;color:#383838;${i < rows.length - 1 ? "border-bottom:1px solid #dfe8fb;" : ""}">${r.labelHtml ?? brandEsc(r.label)}</td><td align="right" style="padding:10px 0;font-size:14px;font-weight:bold;color:${r.color || "#16367f"};${i < rows.length - 1 ? "border-bottom:1px solid #dfe8fb;" : ""}">${r.valueHtml ?? brandEsc(r.value)}</td></tr>`).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7ff;border-radius:8px;padding:6px 16px;margin:4px 0 8px;">${trs}</table>`;
}
// Subtítulo de sección dentro del cuerpo.
function brandSection(title) {
  return `<p style="margin:22px 0 8px;font-size:13px;font-weight:bold;color:#16367f;text-transform:uppercase;letter-spacing:.04em;">${brandEsc(title)}</p>`;
}
// opts: { title, subtitle?, bodyHtml, buttons?: [{label,url,secondary?}], note?, footer?, width? }
function brandEmail(opts) {
  const width = opts.width || 480;
  const subtitle = opts.subtitle
    ? `<tr><td style="font-size:13px;color:#646464;text-align:center;padding-bottom:20px;">${brandEsc(opts.subtitle)}</td></tr>`
    : "";
  const buttons = opts.buttons && opts.buttons.length
    ? `<tr><td align="center" style="padding-bottom:30px;">${opts.buttons.map(brandButton).join("")}</td></tr>`
    : "";
  const note = opts.note
    ? `<tr><td style="font-size:13px;color:#646464;text-align:center;padding-bottom:15px;line-height:1.5;">${opts.note}</td></tr>`
    : "";
  const footerExtra = opts.footer ? `${opts.footer}<br />` : "";
  return `<!DOCTYPE html>
<html lang="es" style="margin:0;padding:0;background:#eaf1ff;">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light only" /><title>${brandEsc(opts.title)}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background-color:#eaf1ff;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eaf1ff;padding:40px 12px;"><tr><td align="center">
<table width="${width}" cellpadding="0" cellspacing="0" style="max-width:100%;background:#ffffff;border-radius:12px;padding:40px 30px;box-shadow:0 4px 10px rgba(0,0,0,0.06);font-family:Arial,Helvetica,sans-serif;">
<tr><td align="center" style="padding-bottom:20px;"><img src="${BRAND_LOGO_URL}" alt="CatalogoHoy" width="90" style="display:block;" /></td></tr>
<tr><td style="font-size:22px;font-weight:bold;color:#16367f;text-align:center;padding-bottom:${opts.subtitle ? "6px" : "10px"};">${brandEsc(opts.title)}</td></tr>
${subtitle}
<tr><td style="font-size:15px;color:#383838;text-align:left;line-height:1.6;padding-bottom:25px;">${opts.bodyHtml}</td></tr>
${buttons}
${note}
<tr><td style="font-size:12px;color:#a6a6a6;text-align:center;padding-top:25px;line-height:1.6;">${footerExtra}© ${new Date().getFullYear()} CatalogoHoy — Todos los derechos reservados.</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}
// ---------------------------------------------------------------------------
function emailShell(opts) {
  const greeting = opts.greetingName ? `Hola ${escape(opts.greetingName.split(" ")[0])},` : "Hola,";
  return brandEmail({
    title: opts.headline,
    subtitle: opts.brandName,
    bodyHtml: `<p style="margin:0 0 12px;">${greeting}</p><p style="margin:0 0 18px;">${escape(opts.body)}</p>${brandRows(opts.rows.map((r) => ({ label: r.label, value: r.value, color: r.danger ? "#dc2626" : undefined })))}`,
    buttons: [{ label: opts.ctaLabel, url: opts.ctaUrl }],
    footer: `Recibiste este email porque eres dueño del catálogo <strong>${escape(opts.brandName)}</strong>. Puedes cambiar los días o apagar estos recordatorios en Perfil → Notificaciones.`
  });
}

async function fetchOwnerInfo(admin, tenantId) {
  const [tenantResp, cfgResp, linkResp, curResp] = await Promise.all([
    admin.from("tenants").select("name, slug").eq("id", tenantId).maybeSingle(),
    admin.from("tenant_ecommerce_config").select("logo, theme_color").eq("tenant_id", tenantId).maybeSingle(),
    admin.from("users_tenants").select("users!inner(name, last_name, email, notify_credit_reminders, credit_reminder_days)").eq("tenant_id", tenantId).eq("role", "owner").limit(1).maybeSingle(),
    admin.from("tenant_currency_config").select("currency_symbol, show_dual_currency, exchange_rate_type, custom_rate, product_currency").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  if (!tenantResp.data) return null;
  const tenant = tenantResp.data;
  const cfg = cfgResp.data ?? null;
  const user = linkResp.data?.users ?? null;
  const email = (user?.email ?? "").trim();
  const name = [user?.name, user?.last_name].filter(Boolean).join(" ").trim() || null;
  return {
    email: email && email.includes("@") ? email : null,
    name,
    notifyCredit: user?.notify_credit_reminders !== false,
    thresholdDays: Number(user?.credit_reminder_days) >= 1 ? Number(user?.credit_reminder_days) : 7,
    tenantName: tenant.name ?? `Tienda #${tenantId}`,
    slug: tenant.slug ?? String(tenantId),
    logo: cfg?.logo ?? null,
    themeColor: cfg?.theme_color ?? "#10b981",
    currency: curResp.data ?? null,
  };
}

// ── Moneda: espejo de TenantCurrencyStore + effectiveOrderBs del front ──────
// Los montos del email respetan la config del catálogo: solo referencia,
// solo Bs, o dual "$X / Bs. Y" (pedido de Nicolas 2026-09-25). Las órdenes a
// crédito usan su snapshot total_bs; sin snapshot cae a la tasa activa.
function moneyFmt(cfg) {
  const ve = cfg?.product_currency === "VES";
  const thou = ve ? "." : ",";
  const dec = ve ? "," : ".";
  return (n, symbol) => {
    const [i, f] = (Number(n) || 0).toFixed(2).split(".");
    return `${symbol}${i.replace(/\B(?=(\d{3})+(?!\d))/g, thou)}${dec}${f}`;
  };
}

function activeRateValue(cfg, rates) {
  const type = cfg?.exchange_rate_type ?? "bcv_usd";
  if (type === "custom") return Number(cfg?.custom_rate) || 0;
  if (type === "bcv_eur") return Number(rates?.bcv_eur) || 0;
  return Number(rates?.bcv_usd) || 0;
}

function effectiveBs(order, cfg, rates) {
  const bs = Number(order.total_bs) || 0;
  if (bs > 0) return bs;
  const rate = activeRateValue(cfg, rates);
  return rate > 0 ? (Number(order.total_usd) || 0) * rate : 0;
}

function amountText(usd, bs, cfg) {
  const sym = (cfg?.currency_symbol ?? "$").trim() || "$";
  let text = moneyFmt(cfg)(usd, sym);
  if (cfg?.show_dual_currency && bs > 0) {
    text += ` / ${moneyFmt({ product_currency: "VES" })(bs, "Bs. ")}`;
  }
  return text;
}

// Destinatarios que SES no puede entregar y se saltan sin llamar a SES (cada
// intento suma un rebote a la reputación de la cuenta): el relay de Apple
// "Ocultar mi correo" (@privaterelay.appleid.com rechaza a remitentes no
// registrados en Apple con "550 unauthorized sender"), dominios de prueba y
// typos frecuentes de gmail/hotmail. Copia idéntica en cada función que manda
// email: si cambiás algo acá, cambialo en todas.
const UNDELIVERABLE_EMAIL_DOMAINS = new Set([
  "privaterelay.appleid.com",
  "example.com", "example.org", "example.net",
  "gmail.comm", "gmail.co.com", "gmail.vom", "gmail.con", "gmail.cm", "gmailcom",
  "gamil.com", "gmial.com", "hitmail.com", "hotmal.com", "hotmail.con"
]);
function isUndeliverableEmail(email: unknown): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return true;
  const domain = e.slice(at + 1);
  if (!domain.includes(".")) return true;
  if (UNDELIVERABLE_EMAIL_DOMAINS.has(domain)) return true;
  return /\.(test|invalid|local|localhost|example)$/.test(domain);
}
async function sendViaSes(to, subject, html, text) {
  if (isUndeliverableEmail(to)) return { ok: false, status: 0, error: "undeliverable recipient" };
  const region = Deno.env.get("AWS_SES_REGION") ?? "sa-east-1";
  const aws = new AwsClient({
    accessKeyId: Deno.env.get("AWS_SES_ACCESS_KEY_ID"),
    secretAccessKey: Deno.env.get("AWS_SES_SECRET_ACCESS_KEY"),
    region, service: "ses",
  });
  const res = await aws.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      FromEmailAddress: `${FROM_NAME} <${FROM_EMAIL}>`,
      Destination: { ToAddresses: [to] },
      Content: { Simple: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: { Html: { Data: html, Charset: "UTF-8" }, Text: { Data: text, Charset: "UTF-8" } },
      } },
      ConfigurationSetName: "catalogohoy-prod",
    }),
  });
  if (!res.ok) throw new Error(`SES ${res.status}: ${await res.text()}`);
}

/** "YYYY-MM-DD" de hoy en UTC (el cron corre 12:00 UTC = mañana en LATAM). */
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shortDate(iso) {
  const [, m, d] = String(iso).split("-");
  return d && m ? `${d}/${m}` : String(iso);
}

/** Primera cuota impaga vencida de la orden, o null. */
function overdueInstallment(order, today) {
  const list = Array.isArray(order.credit_installments) ? order.credit_installments : [];
  const due = list
    .filter((c) => c && typeof c.dueDate === "string" && c.paid !== true && c.dueDate < today)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  return due[0] ?? null;
}

function ageDays(createdAt) {
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const today = todayIso();
  const cooldownIso = new Date(Date.now() - REMIND_COOLDOWN_DAYS * 86_400_000).toISOString();

  // Tasas globales (BCV) una sola vez por corrida — para el dual de VE.
  const { data: globalRates } = await admin
    .from("exchange_rates")
    .select("bcv_usd, bcv_eur")
    .eq("id", 1)
    .maybeSingle();

  // Todas las órdenes a crédito con el cooldown vencido (o nunca avisadas).
  // Volumen actual ~decenas; el limit es holgado y el filtro fino va en memoria.
  const { data: orders, error } = await admin
    .from("orders")
    .select("id, tenant_id, name, order_number, total_usd, total_bs, created_at, credit_installments, credit_reminded_at")
    .eq("status", "credit")
    .or(`credit_reminded_at.is.null,credit_reminded_at.lt.${cooldownIso}`)
    .order("tenant_id", { ascending: true })
    .limit(5000);
  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });

  const byTenant = new Map();
  for (const o of orders ?? []) {
    if (!byTenant.has(o.tenant_id)) byTenant.set(o.tenant_id, []);
    byTenant.get(o.tenant_id).push(o);
  }

  let emails = 0, pushes = 0;
  const markedIds = [];

  for (const [tenantId, list] of byTenant) {
    const owner = await fetchOwnerInfo(admin, tenantId);
    if (!owner || !owner.email || !owner.notifyCredit) continue;

    // Vencidas según la regla: cuota impaga pasada, o (sin cuotas) edad > umbral.
    const overdue = list
      .map((o) => {
        const cuota = overdueInstallment(o, today);
        const hasInstallments = Array.isArray(o.credit_installments) && o.credit_installments.length > 0;
        const days = ageDays(o.created_at);
        const isDue = cuota != null || (!hasInstallments && days > owner.thresholdDays);
        return isDue ? { o, cuota, days } : null;
      })
      .filter(Boolean)
      // Más viejas primero (cuota vencida más antigua, luego edad).
      .sort((a, b) => (b.cuota ? 1 : 0) - (a.cuota ? 1 : 0) || b.days - a.days);

    if (!overdue.length) continue;

    const cfg = owner.currency;
    const fmtRef = moneyFmt(cfg);
    const sym = (cfg?.currency_symbol ?? "$").trim() || "$";
    const dual = cfg?.show_dual_currency === true;
    const shown = overdue.slice(0, MAX_ROWS);
    const rows = shown.map(({ o, cuota, days }) => ({
      label: `${o.name || `Orden #${o.order_number ?? o.id}`} · ${
        cuota ? `cuota vencida el ${shortDate(cuota.dueDate)}` : `hace ${days} días`
      }`,
      value: cuota && cuota.amount != null
        ? fmtRef(cuota.amount, sym)
        : amountText(Number(o.total_usd) || 0, dual ? effectiveBs(o, cfg, globalRates) : 0, cfg),
      danger: cuota != null,
    }));
    if (overdue.length > shown.length) {
      rows.push({ label: `… y ${overdue.length - shown.length} más`, value: "", danger: false });
    }
    const totalUsd = overdue.reduce((acc, { o }) => acc + (Number(o.total_usd) || 0), 0);
    const totalBs = dual
      ? overdue.reduce((acc, { o }) => acc + effectiveBs(o, cfg, globalRates), 0)
      : 0;
    const totalDueText = amountText(totalUsd, totalBs, cfg);

    const headline = "Tienes cobros pendientes";
    const body = overdue.length === 1
      ? "Esta orden a crédito sigue sin cobrarse. Te la recordamos para que no se te pase."
      : `Estas ${overdue.length} órdenes a crédito siguen sin cobrarse (${totalDueText} en total). Te las dejamos ordenadas por antigüedad para que no se te pase ninguna.`;
    const html = emailShell({
      title: headline, headline, headlineColor: "#f59e0b",
      greetingName: owner.name, body, rows,
      ctaLabel: "Ver órdenes a crédito",
      ctaUrl: `https://${owner.slug}.catalogohoy.com/admin/orders`,
      themeColor: owner.themeColor, logo: owner.logo, brandName: owner.tenantName,
    });
    const text = `${headline} en ${owner.tenantName}:\n` +
      rows.map((r) => `- ${r.label}${r.value ? `: ${r.value}` : ""}`).join("\n") +
      `\n\nRevisalas desde tu panel > Órdenes > A crédito. Ajustá o apagá estos avisos en Perfil > Notificaciones.`;
    const subject = overdue.length === 1
      ? `💰 Cobro pendiente: ${overdue[0].o.name || "una orden a crédito"}`
      : `💰 ${overdue.length} cobros pendientes en ${owner.tenantName}`;

    try {
      await sendViaSes(owner.email, subject, html, text);
      emails++;
      markedIds.push(...overdue.map(({ o }) => o.id));

      // Push best-effort (mismo canal del push de "nuevo pedido"). Nunca rompe.
      const pushSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
      if (pushSecret) {
        try {
          const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-webhook-secret": pushSecret },
            body: JSON.stringify({
              tenantId,
              title: overdue.length === 1 ? "Tienes un cobro pendiente 💰" : `Tienes ${overdue.length} cobros pendientes 💰`,
              body: `${totalDueText} por cobrar en ${owner.tenantName}`,
              route: "/admin/orders",
            }),
          });
          if (res.ok) pushes++;
        } catch (_e) { /* push es best-effort */ }
      }
    } catch (_e) {
      // Falla de email: no marcar → reintenta en el próximo cron.
    }
  }

  if (markedIds.length) {
    await admin.from("orders").update({ credit_reminded_at: new Date().toISOString() }).in("id", markedIds);
  }

  return new Response(
    JSON.stringify({ ok: true, tenants: byTenant.size, emails, pushes, marked: markedIds.length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
