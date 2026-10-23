import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";
import { uploadToS3 } from "../_shared/s3.ts";

// =============================================================================
// wa-assistant-launch — anuncio del Asistente WhatsApp (2026-10-22) a los
// dueños de tienda: plantilla MARKETING por WhatsApp (número de la plataforma)
// y correo por SES. Audiencia y deduplicación en SQL:
// marketing_launch_audience(campaign, channel) + tabla marketing_sends.
//
// Auth: x-webhook-secret = secret `wa_launch_secret` del Vault. verify_jwt=false.
// Body { action }:
//   setup     → sube el ícono de WhatsApp a S3 y crea la plantilla en la WABA.
//   icon      → solo copia el ícono a S3.
//   status    → estado de la plantilla en Meta (PENDING / APPROVED / REJECTED).
//   audience  → cuántos recibirían cada canal (sin enviar).
//   costs     → { start, end } lo que Meta cobró por categoría y país (solo lectura).
//   test      → { phone?, email? } manda una muestra sin registrar el envío.
//   send      → { channel: "whatsapp"|"email", limit? } manda un lote a los
//               que aún no lo recibieron. Repetir hasta remaining = 0.
// =============================================================================

const CAMPAIGN = "wa_assistant_launch";
// v2: aclara que por ahora solo se configura desde la web (la app móvil aún no lo tiene).
const TEMPLATE = "wa_assistant_launch_web";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const GRAPH = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;
const WABA_ID = Deno.env.get("WHATSAPP_WABA_ID") ?? "1038950559044032";
const FROM = "CatalogoHoy <noreply@catalogohoy.com>";
const LOGIN_URL = "https://auth.catalogohoy.com";
const WA_ICON_KEY = "email/whatsapp-icon.png";
const WA_ICON_URL = "https://cdn.catalogohoy.com/" + WA_ICON_KEY;
// Ícono de WhatsApp para el correo: se copia una vez (setup) a nuestro CDN.
const WA_ICON_SRC = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/120px-WhatsApp.svg.png";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// --- Layout de marca de emails ----------------------------------------------
// Mismo diseño que las plantillas de Supabase Auth (reset de contraseña, etc.):
// fondo #eaf1ff, card blanca con radio 12px, logo, título #16367f, texto
// #383838 en Arial y botón #3e7bfa con radio 8px. Copia idéntica en cada
// función que manda email: si cambiás algo acá, cambialo en todas.
const BRAND_LOGO_URL = "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/catalogohoy-logo.png";
const BRAND_BLUE = "#3e7bfa";
type BrandButton = { label: string; url: string; secondary?: boolean };
type BrandRow = { label?: string; labelHtml?: string; value?: string; valueHtml?: string; color?: string };
type BrandEmailOpts = { title: string; subtitle?: string; bodyHtml: string; buttons?: BrandButton[]; note?: string; footer?: string; width?: number };
function brandEsc(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
// Botón principal (azul lleno) o secundario (borde azul).
function brandButton(b: BrandButton): string {
  const style = b.secondary
    ? `background-color:#ffffff;color:${BRAND_BLUE};border:2px solid ${BRAND_BLUE};padding:12px 24px;`
    : `background-color:${BRAND_BLUE};color:#ffffff;padding:14px 26px;`;
  return `<a href="${brandEsc(b.url)}" style="${style}text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;margin:4px;">${brandEsc(b.label)}</a>`;
}
// Bloque de datos "etiqueta → valor" en caja celeste (para resúmenes).
function brandRows(rows: BrandRow[]): string {
  const trs = rows.map((r: BrandRow, i: number) => `<tr><td style="padding:10px 0;font-size:14px;color:#383838;${i < rows.length - 1 ? "border-bottom:1px solid #dfe8fb;" : ""}">${r.labelHtml ?? brandEsc(r.label)}</td><td align="right" style="padding:10px 0;font-size:14px;font-weight:bold;color:${r.color || "#16367f"};${i < rows.length - 1 ? "border-bottom:1px solid #dfe8fb;" : ""}">${r.valueHtml ?? brandEsc(r.value)}</td></tr>`).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7ff;border-radius:8px;padding:6px 16px;margin:4px 0 8px;">${trs}</table>`;
}
// Subtítulo de sección dentro del cuerpo.
function brandSection(title: string): string {
  return `<p style="margin:22px 0 8px;font-size:13px;font-weight:bold;color:#16367f;text-transform:uppercase;letter-spacing:.04em;">${brandEsc(title)}</p>`;
}
// opts: { title, subtitle?, bodyHtml, buttons?: [{label,url,secondary?}], note?, footer?, width? }
function brandEmail(opts: BrandEmailOpts): string {
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

function firstName(name: string | null): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

// --- WhatsApp ----------------------------------------------------------------

const TEMPLATE_BODY =
  "Hola {{1}}, ya puedes manejar *{{2}}* chateando por WhatsApp 🤖\n\n" +
  "✅ Sube tu inventario con fotos y precios\n" +
  "✅ Crea y atiende tus órdenes\n" +
  "✅ Pregunta cuánto vendiste\n" +
  "✅ Entiende notas de voz y fotos\n\n" +
  "Está en beta y ya está disponible. Por ahora se configura solo desde la versión web de tu panel (no desde la app móvil). Pronto llegará a la app.";

async function graph(path: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
  });
  return { ok: res.ok, body: await res.json().catch(() => ({})) };
}

function createTemplate() {
  return graph(`${WABA_ID}/message_templates`, {
    method: "POST",
    body: JSON.stringify({
      name: TEMPLATE,
      category: "MARKETING",
      language: "es",
      components: [
        { type: "HEADER", format: "TEXT", text: "Nuevo: Asistente de WhatsApp" },
        { type: "BODY", text: TEMPLATE_BODY, example: { body_text: [["María", "Mi Tienda"]] } },
        { type: "FOOTER", text: "CatalogoHoy" },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "Conectar mi WhatsApp", url: LOGIN_URL }] },
      ],
    }),
  });
}

async function templateStatus() {
  const r = await graph(`${WABA_ID}/message_templates?name=${TEMPLATE}&fields=name,status,category,rejected_reason`);
  return r.body?.data?.[0] ?? r.body;
}

function sendTemplate(phone: string, name: string | null, store: string | null) {
  return graph(`${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: TEMPLATE,
        language: { code: "es" },
        components: [{
          type: "body",
          parameters: [firstName(name) || "emprendedor", (store ?? "").trim() || "tu tienda"]
            .map((text) => ({ type: "text", text })),
        }],
      },
    }),
  });
}

// --- Correo --------------------------------------------------------------------

function renderEmail(name: string | null) {
  const first = firstName(name);
  const hello = first ? `¡Hola ${brandEsc(first)}!` : "¡Hola!";
  const subject = "Ya puedes manejar tu tienda por WhatsApp 🤖";
  const item = (icon: string, title: string, text: string) =>
    `<p style="margin:0 0 6px;">${icon} <b>${title}</b> ${text}</p>`;
  const html = brandEmail({
    title: "Tu tienda, ahora por WhatsApp",
    subtitle: "Nuevo: Asistente de WhatsApp (beta)",
    bodyHtml: `<p style="margin:0 0 16px;text-align:center;"><img src="${WA_ICON_URL}" alt="WhatsApp" width="56" height="56" style="display:inline-block;" /></p>
<p style="margin:0 0 12px;">${hello} Ya puedes manejar tu tienda chateando por WhatsApp. Le escribes como a un empleado y él lo hace por ti:</p>
${item("📦", "Sube tu inventario:", "mándale fotos y precios y crea tus productos.")}
${item("🧾", "Atiende tus órdenes:", "crea, consulta y actualiza pedidos.")}
${item("📊", "Consulta tus ventas:", "“¿cuánto vendí esta semana?”")}
<p style="margin:0 0 12px;">🎙️ <b>Entiende notas de voz, fotos y PDFs.</b></p>
<p style="margin:0 0 12px;">Está en beta, pero ya puedes usarlo. Conéctalo en 1 minuto desde tu panel, en <b>Asistente WhatsApp</b>.</p>
<p style="margin:0;padding:10px 12px;background:#f4f7ff;border-radius:8px;font-size:14px;">💻 Por ahora se configura <b>solo desde la versión web</b> de tu panel (en la computadora o en el navegador del teléfono), no desde la app móvil. Pronto llegará a la app.</p>`,
    buttons: [{ label: "Conectar mi WhatsApp", url: LOGIN_URL }],
    note: "Usa tus créditos de IA: una pregunta corta usa 1 crédito. Si tienes dudas, responde a este correo.",
  });
  const text = `${first ? `¡Hola ${first}!` : "¡Hola!"} Ya puedes manejar tu tienda chateando por WhatsApp.

- Sube tu inventario: mándale fotos y precios y crea tus productos.
- Atiende tus órdenes: crea, consulta y actualiza pedidos.
- Consulta tus ventas: "¿cuánto vendí esta semana?"
- Entiende notas de voz, fotos y PDFs.

Está en beta, pero ya puedes usarlo. Conéctalo desde tu panel, en Asistente WhatsApp: ${LOGIN_URL}

Por ahora se configura solo desde la versión web de tu panel (en la computadora o en el navegador del teléfono), no desde la app móvil. Pronto llegará a la app.

© ${new Date().getFullYear()} CatalogoHoy`;
  return { subject, html, text };
}

async function sendEmail(to: string, name: string | null) {
  const { subject, html, text } = renderEmail(name);
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
      FromEmailAddress: FROM,
      Destination: { ToAddresses: [to] },
      Content: { Simple: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: { Html: { Data: html, Charset: "UTF-8" }, Text: { Data: text, Charset: "UTF-8" } },
      } },
      ConfigurationSetName: "catalogohoy-prod",
      EmailTags: [{ Name: "campaign", Value: CAMPAIGN }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

// --- Lotes ---------------------------------------------------------------------

type Row = { user_id: number; name: string | null; email: string | null; phone: string | null; store: string | null };

async function audience(channel: string): Promise<Row[]> {
  const { data, error } = await admin.rpc("marketing_launch_audience", { p_campaign: CAMPAIGN, p_channel: channel });
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

async function sendBatch(channel: "whatsapp" | "email", limit: number) {
  const rows = (await audience(channel)).slice(0, limit);
  let sent = 0, failed = 0;
  const errors: string[] = [];
  const CONCURRENCY = channel === "whatsapp" ? 5 : 10;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(rows.slice(i, i + CONCURRENCY).map(async (r) => {
      const recipient = channel === "whatsapp" ? r.phone! : r.email!;
      const res = channel === "whatsapp"
        ? await sendTemplate(recipient, r.name, r.store)
        : await sendEmail(recipient, r.name);
      const err = res.ok ? null : JSON.stringify(res.body?.error ?? res.body).slice(0, 500);
      if (res.ok) sent++; else { failed++; if (errors.length < 5) errors.push(err!); }
      await admin.from("marketing_sends").insert({
        campaign: CAMPAIGN,
        channel,
        user_id: r.user_id,
        recipient,
        status: res.ok ? "sent" : "failed",
        message_id: res.body?.messages?.[0]?.id ?? res.body?.MessageId ?? null,
        error: err,
      });
    }));
  }
  const remaining = (await audience(channel)).length;
  return { channel, sent, failed, remaining, errors };
}

function copyIcon(): Promise<string> {
  return fetch(WA_ICON_SRC, { headers: { "User-Agent": "CatalogoHoy/1.0" } })
    .then(async (r) => {
      if (!r.ok) throw new Error(`icon ${r.status}`);
      return uploadToS3(WA_ICON_KEY, new Uint8Array(await r.arrayBuffer()), "image/png");
    })
    .catch((e) => String(e));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  const { data: secret } = await admin.rpc("internal_get_secret", { p_name: "wa_launch_secret" });
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    switch (body.action) {
      case "setup":
        return json({ icon: await copyIcon(), template: (await createTemplate()).body });
      case "icon":
        return json({ icon: await copyIcon() });
      case "status":
        return json(await templateStatus());
      case "costs": {
        // Solo lectura: lo que Meta cobró por categoría y país (start/end en segundos Unix).
        const dims = encodeURIComponent('["PRICING_CATEGORY","COUNTRY"]');
        return json((await graph(
          `${WABA_ID}?fields=pricing_analytics.start(${Number(body.start)}).end(${Number(body.end)}).granularity(DAILY).dimensions(${dims})`,
        )).body);
      }
      case "audience":
        return json({
          whatsapp: (await audience("whatsapp")).length,
          email: (await audience("email")).length,
        });
      case "test": {
        const out: Record<string, unknown> = {};
        if (body.phone) out.whatsapp = (await sendTemplate(String(body.phone), body.name ?? null, body.store ?? null)).body;
        if (body.email) out.email = (await sendEmail(String(body.email), body.name ?? null)).body;
        return json(out);
      }
      case "send": {
        if (body.channel !== "whatsapp" && body.channel !== "email") return json({ error: "channel" }, 400);
        if (body.channel === "whatsapp") {
          const st = await templateStatus();
          if (st?.status !== "APPROVED") return json({ error: "La plantilla aún no está aprobada", status: st }, 409);
        }
        return json(await sendBatch(body.channel, Math.min(Number(body.limit) || 100, 300)));
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
