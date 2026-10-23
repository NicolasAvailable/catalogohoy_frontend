import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";

// Cron (~15 min): agrupa los avisos de stock bajo/agotado encolados por
// decrement_product_stock y le manda al dueño UN email por tienda (AWS SES),
// con el mismo diseño branded que el resto de los correos (emailShell, logo y
// color de cada tienda). Respeta users.notify_low_stock. Marca procesados.
// WhatsApp queda para cuando exista la plantilla UTILITY (ver TODO abajo).
// Auth: header x-webhook-secret (mismo patrón que los demás cron jobs).

const CRON_SECRET = "whsec_low_stock_9b3e7c1a4f206d58aa19c4e7b02f6531";
const FROM_NAME = "CatalogoHoy";
const FROM_EMAIL = "noreply@catalogohoy.com";
const MAX_AGE_DAYS = 3;

function escape(input) {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Mismo shell branded que usa stripe-webhook para sus emails.
// --- Layout de marca de emails ----------------------------------------------
// Mismo diseño que las plantillas de Supabase Auth (reset de contraseña, etc.):
// fondo #eaf1ff, card blanca con radio 12px, logo, título #16367f, texto
// #383838 en Arial y botón #3e7bfa con radio 8px. Copia idéntica en cada
// función que manda email: si cambiás algo acá, cambialo en todas.
const BRAND_LOGO_URL = "https://cdn.catalogohoy.com/catalogohoy-logo.png";
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
    footer: `Recibiste este email porque eres dueño del catálogo <strong>${escape(opts.brandName)}</strong>. Puedes ajustar el umbral o apagar estos avisos en Perfil → Notificaciones.`
  });
}

async function fetchOwnerInfo(admin, tenantId) {
  const [tenantResp, cfgResp, linkResp] = await Promise.all([
    admin.from("tenants").select("name, slug").eq("id", tenantId).maybeSingle(),
    admin.from("tenant_ecommerce_config").select("logo, theme_color").eq("tenant_id", tenantId).maybeSingle(),
    admin.from("users_tenants").select("users!inner(name, last_name, email, notify_low_stock)").eq("tenant_id", tenantId).eq("role", "owner").limit(1).maybeSingle(),
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
    notifyLowStock: user?.notify_low_stock !== false,
    tenantName: tenant.name ?? `Tienda #${tenantId}`,
    slug: tenant.slug ?? String(tenantId),
    logo: cfg?.logo ?? null,
    themeColor: cfg?.theme_color ?? "#10b981",
  };
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

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

  const sinceIso = new Date(Date.now() - MAX_AGE_DAYS * 86400_000).toISOString();
  const { data: alerts, error } = await admin
    .from("low_stock_alerts")
    .select("id,tenant_id,product_id,product_name,scope,scope_label,level,new_stock")
    .is("processed_at", null)
    .gte("created_at", sinceIso)
    .order("tenant_id", { ascending: true })
    .limit(1000);
  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  if (!alerts || alerts.length === 0) {
    return new Response(JSON.stringify({ ok: true, tenants: 0, emails: 0, processed: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const byTenant = new Map();
  for (const a of alerts) {
    if (!byTenant.has(a.tenant_id)) byTenant.set(a.tenant_id, []);
    byTenant.get(a.tenant_id).push(a);
  }

  let emails = 0;
  const processedIds = [];

  for (const [tenantId, list] of byTenant) {
    const ids = list.map((a) => a.id);
    const owner = await fetchOwnerInfo(admin, tenantId);

    // Sin dueño / sin email / avisos apagados: marcar procesados y saltar.
    if (!owner || !owner.email || !owner.notifyLowStock) {
      processedIds.push(...ids);
      continue;
    }

    try {
      // Agotados primero.
      const sorted = [...list].sort((a, b) => Number(b.level === "out") - Number(a.level === "out"));
      const anyOut = sorted.some((a) => a.level === "out");
      const rows = sorted.map((a) => ({
        label: (a.product_name ?? `Producto #${a.product_id}`) + (a.scope_label ? ` · ${a.scope_label}` : ""),
        value: a.level === "out" ? "Agotado" : `Quedan ${a.new_stock}`,
        danger: a.level === "out",
      }));
      const headline = anyOut ? "Tienes productos agotados" : "Productos por agotarse";
      const headlineColor = anyOut ? "#dc2626" : "#f59e0b";
      const body = list.length === 1
        ? "Este producto de tu catálogo necesita reposición. Actualizá su stock para que tus clientes lo sigan viendo disponible."
        : "Estos productos de tu catálogo están bajos o agotados. Actualizá su stock para que tus clientes los sigan viendo disponibles.";
      const html = emailShell({
        title: headline, headline, headlineColor,
        greetingName: owner.name, body, rows,
        ctaLabel: "Reponer stock", ctaUrl: `https://${owner.slug}.catalogohoy.com/admin/products`,
        themeColor: owner.themeColor, logo: owner.logo, brandName: owner.tenantName,
      });
      const text = `${headline} en ${owner.tenantName}:\n` +
        rows.map((r) => `- ${r.label}: ${r.value}`).join("\n") +
        `\n\nReponé stock desde tu panel > Productos. Ajustá o apagá estos avisos en Perfil > Notificaciones.`;
      const subject = list.length === 1
        ? `${anyOut ? "⚠️ Se agotó" : "⚠️ Poco stock"}: ${list[0].product_name ?? "un producto"}`
        : `⚠️ ${list.length} productos por agotarse en ${owner.tenantName}`;
      await sendViaSes(owner.email, subject, html, text);
      emails++;
      processedIds.push(...ids);
      // TODO WhatsApp: cuando exista la plantilla UTILITY 'low_stock' + fila en
      // whatsapp_notification_settings (tenant_id,type='low_stock',enabled),
      // POST a /functions/v1/send-whatsapp-notification con este resumen.
    } catch (_e) {
      // Falla de envío: dejar sin procesar para reintentar hasta MAX_AGE_DAYS.
    }
  }

  if (processedIds.length) {
    await admin.from("low_stock_alerts").update({ processed_at: new Date().toISOString() }).in("id", processedIds);
  }

  return new Response(
    JSON.stringify({ ok: true, tenants: byTenant.size, emails, processed: processedIds.length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
