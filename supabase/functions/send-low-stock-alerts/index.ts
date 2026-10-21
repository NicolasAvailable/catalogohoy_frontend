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
