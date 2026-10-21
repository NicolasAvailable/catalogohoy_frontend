import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";
// ============================================================================
// send-activation-nudges (CAT-66) — secuencia de activación (onboarding drip).
// Corre por cron diario. Para cada tienda reciente que aún NO activó (0 órdenes)
// calcula el "paso" según días-desde-signup + si ya cargó productos, y manda el
// siguiente empujón por email. Idempotente: 1 fila por (tienda, paso) en
// customer_success_sends con event_key `activation_<step>:<tenantId>`.
//
// Auth del cron: x-webhook-secret contra el Vault `customer_success_webhook_secret`
// (o env CUSTOMER_SUCCESS_WEBHOOK_SECRET). Mismo secreto que send-customer-success.
//
// Params (body JSON) para rollout/tests:
//   { dryRun?, preview?: '<step>', onlyTenantId?, limit?, record?, sendEmail? }
// ============================================================================
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret"
};
function firstNameOf(name, fallback) {
  const n = (name ?? "").trim().split(/\s+/)[0];
  return n || fallback;
}
function escapeHtml(input) {
  if (input == null) return "";
  return String(input).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}
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
// --- Contenido por paso ------------------------------------------------------
const STEP_ORDER = ["no_product_d1", "no_product_d3", "no_product_d7", "share_d3", "tips_d8"];
function resolveStep(c) {
  const a = c.age_days;
  if (!c.has_product) {
    if (a >= 1 && a <= 2) return "no_product_d1";
    if (a >= 3 && a <= 6) return "no_product_d3";
    if (a >= 7 && a <= 10) return "no_product_d7";
  } else {
    if (a >= 2 && a <= 6) return "share_d3";
    if (a >= 7 && a <= 12) return "tips_d8";
  }
  return null;
}
function stepContent(step, c) {
  const slug = c.slug || "";
  const adminUrl = `https://${slug}.catalogohoy.com/admin/products`;
  const catalogUrl = `https://${slug}.catalogohoy.com`;
  switch(step){
    case "no_product_d1":
      return { subject: "Cargá tu primer producto y activá tu catálogo 🛍️", eyebrow: "Primeros pasos", headline: "Tu catálogo está a un paso.", body: ["Ya creaste tu tienda en CatalogoHoy. Solo falta cargar tu primer producto — te lleva 2 minutos — y ya vas a poder compartir tu catálogo y recibir pedidos por WhatsApp."], ctaText: "Cargar mi primer producto", ctaUrl: adminUrl };
    case "no_product_d3":
      return { subject: "¿Te damos una mano con tu catálogo?", eyebrow: "Primeros pasos", headline: "¿Necesitás ayuda para arrancar?", body: ["Vimos que todavía no cargaste productos. Podés cargarlos uno por uno o importarlos desde un Excel de una sola vez.", "Si querés que te ayudemos, respondé este correo o escribinos por WhatsApp — lo dejamos listo con vos."], ctaText: "Cargar productos", ctaUrl: adminUrl };
    case "no_product_d7":
      return { subject: "Tu catálogo te está esperando ⏳", eyebrow: "Primeros pasos", headline: "Dale vida a tu catálogo.", body: ["Tu tienda sigue vacía. En menos de lo que pensás podés tenerla lista y empezar a vender por WhatsApp.", "¿Arrancamos? Con cargar unos pocos productos ya alcanza para compartir tu catálogo."], ctaText: "Cargar mi primer producto", ctaUrl: adminUrl };
    case "share_d3":
      return { subject: "¡Tu catálogo está listo! Ahora, a compartirlo 🚀", eyebrow: "Conseguí tus primeras ventas", headline: "Ya tenés productos. Ahora, que te encuentren.", body: ["Compartí el link de tu catálogo en tu estado de WhatsApp, en tu bio de Instagram y con tus clientes. Cada visita es una venta posible."], ctaText: "Ver y compartir mi catálogo", ctaUrl: catalogUrl };
    case "tips_d8":
      return { subject: "3 formas de conseguir tus primeras ventas", eyebrow: "Conseguí tus primeras ventas", headline: "¿Todavía sin pedidos? Probá esto.", body: ["1. Poné el link de tu catálogo en tu <b>estado de WhatsApp</b> — es donde tus clientes ya te ven.", "2. Sumalo a tu <b>bio de Instagram / TikTok</b>.", "3. Mandáselo directo a tus mejores clientes con un mensaje corto."], ctaText: "Compartir mi catálogo", ctaUrl: catalogUrl };
  }
  return null;
}
function renderActivationEmail(step, c) {
  const content = stepContent(step, c);
  if (!content) return null;
  const first = firstNameOf(c.owner_name, c.catalog_name || "");
  const bodyHtml = `<p style="margin:0 0 14px;">Hola ${escapeHtml(first)},</p><p style="margin:0 0 14px;font-size:17px;font-weight:bold;color:#16367f;">${escapeHtml(content.headline)}</p>` + content.body.map((p)=>`<p style="margin:0 0 14px;">${p}</p>`).join("");
  const html = brandEmail({
    title: content.eyebrow,
    bodyHtml,
    buttons: [{ label: content.ctaText, url: content.ctaUrl }],
    footer: `Te escribimos porque creaste <strong>${escapeHtml(c.catalog_name || "tu catálogo")}</strong> en CatalogoHoy.`
  });
  const text = [`Hola ${first},`, "", content.headline, "", ...content.body.map((p)=>p.replace(/<[^>]+>/g, "")), "", `${content.ctaText}: ${content.ctaUrl}`].join("\n");
  return { subject: content.subject, html, text };
}
// --- Email (AWS SES → MailerSend → Resend) -----------------------------------
function hasEmailProvider() {
  return !!(Deno.env.get("AWS_SES_ACCESS_KEY_ID") || Deno.env.get("MAILER_SEND_API_KEY") || Deno.env.get("RESEND_API_KEY"));
}
async function sendViaSes(to, fromName, fromEmail, subject, html, text) {
  const region = Deno.env.get("AWS_SES_REGION") ?? "sa-east-1";
  const aws = new AwsClient({ accessKeyId: Deno.env.get("AWS_SES_ACCESS_KEY_ID"), secretAccessKey: Deno.env.get("AWS_SES_SECRET_ACCESS_KEY"), region, service: "ses" });
  const res = await aws.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ FromEmailAddress: `${fromName} <${fromEmail}>`, Destination: { ToAddresses: to }, Content: { Simple: { Subject: { Data: subject, Charset: "UTF-8" }, Body: { Html: { Data: html, Charset: "UTF-8" }, ...text ? { Text: { Data: text, Charset: "UTF-8" } } : {} } } }, ConfigurationSetName: "catalogohoy-prod" }) });
  if (!res.ok) return { ok: false, id: null, status: res.status, error: await res.text().catch(()=>"") };
  const j = await res.json().catch(()=>null);
  return { ok: true, id: j?.MessageId ?? null, status: res.status };
}
async function deliverEmail(opts) {
  const to = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter((e)=>e && e.includes("@"));
  if (to.length === 0) return { ok: false, id: null, status: 0, error: "no recipients" };
  const fromName = opts.fromName ?? "CatalogoHoy";
  const fromEmail = opts.fromEmail ?? "noreply@catalogohoy.com";
  if (Deno.env.get("AWS_SES_ACCESS_KEY_ID") && Deno.env.get("AWS_SES_SECRET_ACCESS_KEY")) {
    return await sendViaSes(to, fromName, fromEmail, opts.subject, opts.html, opts.text);
  }
  const msToken = Deno.env.get("MAILER_SEND_API_KEY");
  if (msToken) {
    const res = await fetch("https://api.mailersend.com/v1/email", { method: "POST", headers: { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ from: { email: fromEmail, name: fromName }, to: to.map((email)=>({ email })), subject: opts.subject, html: opts.html, ...opts.text ? { text: opts.text } : {} }) });
    const id = res.headers.get("x-message-id");
    if (!res.ok) return { ok: false, id, status: res.status, error: await res.text().catch(()=>"") };
    return { ok: true, id, status: res.status };
  }
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to, subject: opts.subject, html: opts.html, ...opts.text ? { text: opts.text } : {} }) });
    if (!res.ok) return { ok: false, id: null, status: res.status, error: await res.text().catch(()=>"") };
    const j = await res.json().catch(()=>null);
    return { ok: true, id: j?.id ?? null, status: res.status };
  }
  return { ok: false, id: null, status: 0, error: "No email provider" };
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  let expectedSecret = Deno.env.get("CUSTOMER_SUCCESS_WEBHOOK_SECRET") ?? null;
  if (!expectedSecret) {
    const { data } = await admin.rpc("internal_get_secret", { p_name: "customer_success_webhook_secret" });
    expectedSecret = data ?? null;
  }
  if (!expectedSecret || req.headers.get("x-webhook-secret") !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  let opts = {};
  try { opts = req.method === "POST" ? await req.json() : {}; } catch { opts = {}; }
  // preview: renderiza el email de un paso sin tocar la DB (para inspección).
  if (opts.preview) {
    const sample = { slug: opts.slug || "mi-tienda", owner_name: opts.owner_name || "María", catalog_name: opts.catalog_name || "Mi Tienda", age_days: 3, has_product: opts.preview.startsWith("share") || opts.preview.startsWith("tips") };
    const r = renderActivationEmail(opts.preview, sample);
    return new Response(JSON.stringify({ preview: opts.preview, ...r }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const record = opts.record !== false;
  const sendEmail = opts.sendEmail !== false;
  const emailReady = hasEmailProvider();
  const { data: rows, error } = await admin.rpc("activation_nudge_candidates");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  let candidates = (rows ?? []).map((c)=>({ ...c, step: resolveStep(c) })).filter((c)=>c.step);
  if (opts.onlyTenantId) candidates = candidates.filter((c)=>c.tenant_id === opts.onlyTenantId);
  // Excluir los que ya recibieron ese paso (idempotencia).
  if (candidates.length) {
    const tenantIds = [...new Set(candidates.map((c)=>c.tenant_id))];
    const { data: sent } = await admin.from("customer_success_sends").select("event_key").in("tenant_id", tenantIds).like("event_key", "activation_%");
    const already = new Set((sent ?? []).map((r)=>r.event_key));
    candidates = candidates.filter((c)=>!already.has(`activation_${c.step}:${c.tenant_id}`));
  }
  candidates.sort((a, b)=>b.tenant_id - a.tenant_id);
  if (opts.limit && opts.limit > 0) candidates = candidates.slice(0, opts.limit);
  const byStep = {};
  for (const c of candidates) byStep[c.step] = (byStep[c.step] || 0) + 1;
  if (opts.dryRun) {
    return new Response(JSON.stringify({ dryRun: true, count: candidates.length, byStep, candidates: candidates.map((c)=>({ tenant_id: c.tenant_id, slug: c.slug, age_days: c.age_days, has_product: c.has_product, step: c.step, owner_email: c.owner_email })) }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }
  let emailsSent = 0;
  const summary = [];
  for (const c of candidates){
    let emailOk = false;
    if (sendEmail && emailReady && c.owner_email && c.owner_email.includes("@")) {
      try {
        const r = renderActivationEmail(c.step, c);
        if (r) { const d = await deliverEmail({ to: c.owner_email, subject: r.subject, html: r.html, text: r.text }); emailOk = d.ok; }
      } catch { emailOk = false; }
    }
    let recorded = false;
    if (record && emailOk) {
      const { error: insErr } = await admin.from("customer_success_sends").insert({ tenant_id: c.tenant_id, event_key: `activation_${c.step}:${c.tenant_id}`, channel: "email", recipient: c.owner_email });
      recorded = !insErr;
    }
    if (emailOk) emailsSent++;
    summary.push({ tenantId: c.tenant_id, step: c.step, email: emailOk, recorded });
  }
  return new Response(JSON.stringify({ condition: "activation_nudges", processed: candidates.length, emails: emailsSent, byStep, summary }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
