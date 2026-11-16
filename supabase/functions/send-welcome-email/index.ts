import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";

// Email de bienvenida al CREAR la cuenta (no al terminar el onboarding).
// Lo dispara el trigger `on_auth_user_confirmed_send_welcome` en auth.users:
// signup por email → cuando confirma el código (email_confirmed_at null → set);
// Google → en el INSERT (ya viene confirmado). Idempotencia:
// users.welcome_email_sent_at (se marca antes de enviar y se libera si SES falla).
//
// Auth: x-webhook-secret contra el secret `welcome_email_webhook_secret` en
// Vault (o env WELCOME_EMAIL_WEBHOOK_SECRET como override).
// Body: { auth_user_id: string }.

const FROM = "CatalogoHoy <noreply@catalogohoy.com>";
const LOGIN_URL = "https://auth.catalogohoy.com";

function escape(input: unknown): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

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
// ---------------------------------------------------------------------------

function renderWelcome(name: string | null) {
  const first = (name ?? "").trim().split(/\s+/)[0];
  const hello = first ? `¡Hola ${escape(first)}!` : "¡Hola!";
  const subject = "¡Bienvenido a CatalogoHoy! 🎉";
  const html = brandEmail({
    title: "¡Bienvenido a CatalogoHoy!",
    bodyHtml: `<p style="margin:0 0 12px;">${hello} Estamos muy felices de tenerte con nosotros.</p>
<p style="margin:0;">Tu cuenta ya está creada. Ahora solo queda terminar la configuración de tu tienda: tu catálogo, tus productos y tus métodos de pago. Te toma pocos minutos.</p>`,
    buttons: [{ label: "Terminar mi configuración", url: LOGIN_URL }],
    note: `Si tienes alguna duda, responde a este correo o escríbenos por WhatsApp. Estamos para ayudarte.`,
  });
  const text = `${first ? `¡Hola ${first}!` : "¡Hola!"} Estamos muy felices de tenerte en CatalogoHoy.

Tu cuenta ya está creada. Ahora solo queda terminar la configuración de tu tienda: ${LOGIN_URL}

© ${new Date().getFullYear()} CatalogoHoy`;
  return { subject, html, text };
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
async function sendViaSes(to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; status: number; error?: string }> {
  if (isUndeliverableEmail(to)) return { ok: false, status: 0, error: "undeliverable recipient" };
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
    }),
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(() => "") };
  return { ok: true, status: res.status };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let expectedSecret = Deno.env.get("WELCOME_EMAIL_WEBHOOK_SECRET") ?? null;
  if (!expectedSecret) {
    const { data } = await admin.rpc("internal_get_secret", { p_name: "welcome_email_webhook_secret" });
    expectedSecret = (data as string | null) ?? null;
  }
  if (!expectedSecret || req.headers.get("x-webhook-secret") !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { auth_user_id?: string; dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.auth_user_id) return json({ error: "auth_user_id required" }, 400);

  if (body.dryRun) {
    const { data: u } = await admin.from("users").select("email, name").eq("auth_user_id", body.auth_user_id).maybeSingle();
    return json({ dryRun: true, to: u?.email ?? null, ...renderWelcome(u?.name ?? null) });
  }

  // Reserva atómica: solo un envío por usuario aunque el trigger corra dos veces.
  const { data: claimed, error } = await admin
    .from("users")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("auth_user_id", body.auth_user_id)
    .is("welcome_email_sent_at", null)
    .select("id, email, name")
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!claimed) return json({ skipped: "already sent or user not found" });
  if (!claimed.email || !claimed.email.includes("@")) return json({ skipped: "no email" });

  const { subject, html, text } = renderWelcome(claimed.name);
  const res = await sendViaSes(claimed.email, subject, html, text);
  if (!res.ok) {
    await admin.from("users").update({ welcome_email_sent_at: null }).eq("id", claimed.id);
    return json({ error: `SES ${res.status}: ${res.error}` }, 502);
  }
  return json({ sent: true });
});
