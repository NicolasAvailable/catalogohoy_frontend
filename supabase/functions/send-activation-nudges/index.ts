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
  const bodyHtml = content.body.map((p)=>`<p style=\"margin:0 0 14px;font-size:14px;color:#475569;line-height:1.65;\">${p}</p>`).join("");
  const html = `<!DOCTYPE html>\n<html lang=\"es\"><head><meta charset=\"utf-8\" /><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" /><title>${escapeHtml(content.subject)}</title></head>\n<body style=\"margin:0;padding:0;background:#f2f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;\">\n<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\" style=\"background:#f2f5f9;padding:24px 12px;\"><tr><td align=\"center\">\n<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"560\" style=\"max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8edf3;\">\n  <tr><td style=\"height:3px;background:#2f63f6;font-size:0;line-height:0;\">&nbsp;</td></tr>\n  <tr><td style=\"padding:18px 26px;border-bottom:1px solid #eef2f7;\">\n    <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\"><tr>\n      <td valign=\"middle\" style=\"font-size:16px;font-weight:800;color:#0f172a;letter-spacing:-0.01em;\">CatalogoHoy</td>\n      <td valign=\"middle\" align=\"right\" style=\"font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;\">${escapeHtml(content.eyebrow)}</td>\n    </tr></table>\n  </td></tr>\n  <tr><td style=\"padding:26px 26px 6px;\">\n    <p style=\"margin:0 0 6px;font-size:13px;color:#64748b;\">Hola ${escapeHtml(first)},</p>\n    <p style=\"margin:0 0 14px;font-size:20px;line-height:1.35;font-weight:800;color:#0f172a;letter-spacing:-0.01em;\">${escapeHtml(content.headline)}</p>\n    ${bodyHtml}\n    <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"margin:8px 0 18px;\"><tr><td style=\"border-radius:9px;background:#2f63f6;\">\n      <a href=\"${escapeHtml(content.ctaUrl)}\" style=\"display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:9px;\">${escapeHtml(content.ctaText)}&nbsp;→</a>\n    </td></tr></table>\n  </td></tr>\n  <tr><td style=\"padding:18px 26px;text-align:center;background:#fbfcfe;border-top:1px solid #f1f5f9;\">\n    <p style=\"margin:0;font-size:11px;line-height:1.7;color:#94a3b8;\">Te escribimos porque creaste <strong style=\"color:#64748b;\">${escapeHtml(c.catalog_name || "tu catálogo")}</strong> en CatalogoHoy.<br><a href=\"https://catalogohoy.com\" style=\"color:#94a3b8;text-decoration:none;\">CatalogoHoy</a></p>\n  </td></tr>\n</table></td></tr></table></body></html>`;
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
