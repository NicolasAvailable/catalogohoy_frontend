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
function emailShell(opts) {
  const themeColor = opts.themeColor || "#10b981";
  const headerInner = opts.logo
    ? `<img src="${escape(opts.logo)}" alt="${escape(opts.brandName)}" width="56" height="56" style="display:inline-block;border-radius:50%;border:3px solid #ffffff;background:#ffffff;" />`
    : `<div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:#ffffff33;line-height:56px;font-weight:700;font-size:22px;color:#ffffff;">${escape(opts.brandName.charAt(0))}</div>`;
  const greeting = opts.greetingName ? `Hola ${escape(opts.greetingName.split(" ")[0])},` : "Hola,";
  const rowsHtml = opts.rows.map((r) => `<tr><td style="padding:8px 0;font-size:14px;color:#334155;border-bottom:1px solid #eef2f7;">${escape(r.label)}</td><td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #eef2f7;color:${r.danger ? "#dc2626" : "#0f766e"};">${escape(r.value)}</td></tr>`).join("");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${escape(opts.title)}</title></head><body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',-apple-system,sans-serif;color:#1e293b;"><table cellspacing="0" cellpadding="0" width="100%" style="background:#f8fafc;padding:24px 12px;"><tr><td align="center"><table cellspacing="0" cellpadding="0" width="600" style="max-width:100%;background:#fff;border-radius:16px;overflow:hidden;"><tr><td style="background:${themeColor};padding:32px 24px;text-align:center;">${headerInner}<h1 style="margin:16px 0 4px;font-size:18px;font-weight:700;color:#fff;">${escape(opts.brandName)}</h1><p style="margin:0;font-size:13px;color:#ffffffcc;">CatalogoHoy</p></td></tr><tr><td style="padding:32px 24px;"><div style="background:${opts.headlineColor}1A;border-left:4px solid ${opts.headlineColor};border-radius:8px;padding:14px 16px;margin-bottom:24px;"><p style="margin:0;font-size:18px;font-weight:700;color:${opts.headlineColor};">${escape(opts.headline)}</p></div><p style="margin:0 0 12px;font-size:15px;">${greeting}</p><p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">${escape(opts.body)}</p><div style="background:#f8fafc;border-radius:12px;padding:6px 18px;margin-bottom:24px;"><table cellspacing="0" cellpadding="0" width="100%">${rowsHtml}</table></div><div style="text-align:center;margin:24px 0 8px;"><a href="${escape(opts.ctaUrl)}" style="display:inline-block;background:${themeColor};color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px;">${escape(opts.ctaLabel)} →</a></div></td></tr><tr><td style="padding:20px 24px;text-align:center;background:#f8fafc;border-top:1px solid #f1f5f9;"><p style="margin:0;font-size:11px;color:#94a3b8;">Recibiste este email porque sos dueño del catálogo <strong>${escape(opts.brandName)}</strong>. Podés ajustar el umbral o apagar estos avisos en Perfil → Notificaciones.<br>CatalogoHoy · <a href="https://catalogohoy.com" style="color:#94a3b8;">catalogohoy.com</a></p></td></tr></table></td></tr></table></body></html>`;
}

async function fetchOwnerInfo(admin, tenantId) {
  const [tenantResp, cfgResp, linkResp] = await Promise.all([
    admin.from("tenants").select("name, slug").eq("id", tenantId).maybeSingle(),
    admin.from("tenant_ecommerce_config").select("logo, theme_color, currency_symbol").eq("tenant_id", tenantId).maybeSingle(),
    admin.from("users_tenants").select("users!inner(name, last_name, email, notify_credit_reminders, credit_reminder_days)").eq("tenant_id", tenantId).eq("role", "owner").limit(1).maybeSingle(),
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
    currencySymbol: (cfg?.currency_symbol ?? "$").trim() || "$",
  };
}

async function sendViaSes(to, subject, html, text) {
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

  // Todas las órdenes a crédito con el cooldown vencido (o nunca avisadas).
  // Volumen actual ~decenas; el limit es holgado y el filtro fino va en memoria.
  const { data: orders, error } = await admin
    .from("orders")
    .select("id, tenant_id, name, order_number, total_usd, created_at, credit_installments, credit_reminded_at")
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

    const sym = owner.currencySymbol;
    const fmt = (n) => `${sym}${Number(n).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const shown = overdue.slice(0, MAX_ROWS);
    const rows = shown.map(({ o, cuota, days }) => ({
      label: `${o.name || `Orden #${o.order_number ?? o.id}`} · ${
        cuota ? `cuota vencida el ${shortDate(cuota.dueDate)}` : `hace ${days} días`
      }`,
      value: fmt(cuota && cuota.amount != null ? cuota.amount : o.total_usd),
      danger: cuota != null,
    }));
    if (overdue.length > shown.length) {
      rows.push({ label: `… y ${overdue.length - shown.length} más`, value: "", danger: false });
    }
    const totalDue = overdue.reduce((acc, { o }) => acc + (Number(o.total_usd) || 0), 0);

    const headline = "Tienes cobros pendientes";
    const body = overdue.length === 1
      ? "Esta orden a crédito sigue sin cobrarse. Te la recordamos para que no se te pase."
      : `Estas ${overdue.length} órdenes a crédito siguen sin cobrarse (${fmt(totalDue)} en total). Te las dejamos ordenadas por antigüedad para que no se te pase ninguna.`;
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
              body: `${fmt(totalDue)} por cobrar en ${owner.tenantName}`,
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
