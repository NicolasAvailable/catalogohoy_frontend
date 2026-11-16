import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";

// Correo de resumen de un import de productos que terminó en SEGUNDO PLANO
// (el usuario cerró el modal y siguió usando la app). El front lo llama al
// terminar con { jobId }; se manda una sola vez por job (emailed_at) y solo
// al usuario que hizo el import. Contenido: cuántos productos/fotos entraron,
// cuántos fallaron y la lista de errores (máx. 25 en el correo).
// Tabla: product_import_jobs (migración 20261110_product_import_jobs.sql).

const FROM_NAME = "CatalogoHoy";
const FROM_EMAIL = "noreply@catalogohoy.com";
const MAX_ERRORS_IN_EMAIL = 25;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
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


const SOURCE_LABEL: Record<string, string> = {
  excel: "Excel",
  sheets: "Google Sheets",
  pdf: "PDF",
  fotos: "Fotos",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ ok: false, error: "Unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ ok: false, error: "Unauthorized" }, 401);

  let jobId = "";
  try {
    jobId = String((await req.json())?.jobId ?? "");
  } catch { /* body inválido */ }
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ ok: false, error: "jobId inválido" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Reclamar el envío de forma atómica: solo el dueño del job, una vez, y
  // solo si ya terminó.
  const { data: job, error: claimError } = await admin
    .from("product_import_jobs")
    .update({ emailed_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("auth_user_id", user.id)
    .is("emailed_at", null)
    .neq("status", "running")
    .select("id, tenant_id, source, file_name, status, total, processed, success, errors, skipped, failed")
    .maybeSingle();
  if (claimError) return json({ ok: false, error: claimError.message }, 500);
  if (!job) return json({ ok: true, skipped: "already sent or not found" });

  const email = (user.email ?? "").trim();
  if (!email || isUndeliverableEmail(email)) return json({ ok: true, skipped: "no email" });

  const [{ data: tenant }, { data: profile }] = await Promise.all([
    admin.from("tenants").select("name, slug").eq("id", job.tenant_id).maybeSingle(),
    admin.from("users").select("name").eq("auth_user_id", user.id).maybeSingle(),
  ]);
  const tenantName = tenant?.name ?? "tu tienda";
  const slug = tenant?.slug ?? "";
  const firstName = String(profile?.name ?? "").trim().split(" ")[0];

  const isPhotos = job.source === "fotos";
  const failed = Array.isArray(job.failed) ? job.failed : [];
  const cancelled = job.status === "cancelled";
  const hasErrors = job.errors > 0;
  const what = isPhotos ? "subida de fotos" : "importación de productos";
  const title = cancelled
    ? `Tu ${what} se canceló`
    : hasErrors ? `Tu ${what} terminó con errores` : `Tu ${what} terminó`;

  const rows = [
    { label: "Origen", value: `${SOURCE_LABEL[job.source] ?? job.source}${job.file_name ? ` · ${job.file_name}` : ""}` },
    { label: isPhotos ? "Fotos aplicadas" : "Productos importados", value: String(job.success), color: "#16a34a" },
  ];
  if (hasErrors) rows.push({ label: "Con error", value: String(job.errors), color: "#dc2626" });
  if (job.skipped > 0) rows.push({ label: "Por límite de fotos del plan", value: String(job.skipped), color: "#d97706" });
  if (cancelled) rows.push({ label: "Procesados", value: `${job.processed} de ${job.total}` });

  const shown = failed.slice(0, MAX_ERRORS_IN_EMAIL);
  const errorsHtml = shown.length
    ? brandSection("Qué falló") +
      `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">` +
      shown.map((f: { name?: string; error?: string }) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f1f1;"><strong style="color:#383838;">${brandEsc(f.name || "—")}</strong><br /><span style="color:#dc2626;">${brandEsc(f.error || "")}</span></td></tr>`
      ).join("") +
      `</table>` +
      (failed.length > shown.length
        ? `<p style="margin:8px 0 0;font-size:13px;color:#646464;">Y ${failed.length - shown.length} más: los ves todos en Productos.</p>`
        : "")
    : "";

  const intro = hasErrors
    ? (isPhotos
      ? "Terminamos de subir tus fotos. Algunas no se pudieron aplicar; abajo te contamos cuáles y por qué."
      : "Terminamos de importar tus productos. Algunas filas no se pudieron importar; abajo te contamos cuáles y por qué. Puedes corregirlas y volver a subir el archivo: lo que ya entró se actualiza, no se duplica.")
    : (isPhotos ? "Terminamos de subir tus fotos." : "Terminamos de importar tus productos. Ya están en tu catálogo.");

  const html = brandEmail({
    title,
    subtitle: tenantName,
    bodyHtml:
      `<p style="margin:0 0 12px;">${firstName ? `Hola ${brandEsc(firstName)},` : "Hola,"}</p>` +
      `<p style="margin:0 0 18px;">${brandEsc(intro)}</p>` +
      brandRows(rows) + errorsHtml,
    buttons: [{ label: "Ver mis productos", url: slug ? `https://${slug}.catalogohoy.com/admin/products` : "https://catalogohoy.com/admin" }],
    footer: `Recibiste este correo porque hiciste una importación en <strong>${brandEsc(tenantName)}</strong> y seguiste usando la app mientras terminaba.`,
  });
  const text = `${title} (${tenantName})\n` +
    rows.map((r) => `- ${r.label}: ${r.value}`).join("\n") +
    (shown.length ? `\n\nQué falló:\n` + shown.map((f: { name?: string; error?: string }) => `- ${f.name || "—"}: ${f.error || ""}`).join("\n") : "") +
    `\n\nVer mis productos: https://${slug}.catalogohoy.com/admin/products`;
  const subject = hasErrors
    ? `⚠️ ${title}: ${job.success} bien, ${job.errors} con error`
    : `✅ ${title}: ${job.success} ${isPhotos ? "fotos" : "productos"}`;

  try {
    await sendViaSes(email, subject, html, text);
  } catch (e) {
    // Liberar el reclamo para poder reintentar.
    await admin.from("product_import_jobs").update({ emailed_at: null }).eq("id", job.id);
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 502);
  }
  return json({ ok: true });
});
