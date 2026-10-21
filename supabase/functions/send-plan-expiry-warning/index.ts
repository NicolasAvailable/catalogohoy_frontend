import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1";

// Cron diario (13:00 UTC, pg_cron `send-plan-expiry-warnings-daily`): avisa a
// los dueños que su plan vence en 6/4/2/0 días.
// - EMAIL (AWS SES): idempotencia por fila en tenant_expiry_warnings.
// - WHATSAPP (template plan_expiry_warning, W6): idempotencia propia con
//   tenant_expiry_warnings.whatsapp_sent_at — permite catch-up el mismo día
//   sin duplicar emails. Destinatario vía RPC resolve_billing_wa_recipient.
//
// Auth del cron: x-webhook-secret contra el secret `plan_expiry_webhook_secret`
// en Supabase Vault (o env PLAN_EXPIRY_WEBHOOK_SECRET como override) — nada
// hardcodeado porque este repo es público.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const THRESHOLDS = [6, 4, 2, 0] as const;
type Threshold = (typeof THRESHOLDS)[number];

interface Candidate {
  tenant_id: number;
  tenant_name: string;
  slug: string;
  custom_domain: string | null;
  plan_id: string | null;
  plan_expires_at: string;
  stripe_subscription_status: string | null;
  logo: string | null;
  theme_color: string;
  owner_user_id: number;
  owner_email: string;
  owner_name: string | null;
  notify_plan_expiry: boolean;
}

function escape(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** dd/mm/aaaa — el formato del {{3}} del template de WhatsApp. */
function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function planLabel(planId: string | null | undefined): string {
  if (!planId) return "—";
  return planId.charAt(0).toUpperCase() + planId.slice(1);
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

/** Threshold-specific copy. The 0-day case is the most urgent so we lean
 *  in on the language; 6 days is informational. */
function copyForThreshold(days: Threshold, autoRenews: boolean): {
  subject: string;
  headline: string;
  body: string;
  cta: string;
  color: string;
} {
  const cta = autoRenews ? "Ver mis planes" : "Renovar mi plan";
  if (days === 0) {
    return {
      subject: "Tu plan vence hoy — CatalogoHoy",
      headline: "Tu plan vence hoy",
      body: autoRenews
        ? "Tu suscripción se renovará automáticamente en las próximas horas. Si no querés renovarla podés cancelarla desde tu panel."
        : "Hoy es el último día. Si no renovás, perderás acceso a las funciones premium de tu catálogo.",
      cta,
      color: "#dc2626",
    };
  }
  if (days === 2) {
    return {
      subject: "Tu plan vence en 2 días — CatalogoHoy",
      headline: "Tu plan vence en 2 días",
      body: autoRenews
        ? "Tu suscripción se renovará automáticamente. No tenés que hacer nada — te avisamos por si querés revisar el estado."
        : "Quedan 2 días para que tu plan expire. Renovalo para no perder acceso a tu catálogo premium.",
      cta,
      color: "#ea580c",
    };
  }
  if (days === 4) {
    return {
      subject: "Tu plan vence en 4 días — CatalogoHoy",
      headline: "Tu plan vence en 4 días",
      body: autoRenews
        ? "En 4 días se cobra automáticamente la renovación de tu plan. Si querés actualizar tu método de pago, hacelo desde tu panel."
        : "Faltan 4 días para que tu plan expire. Renovalo con tiempo y evitá sorpresas.",
      cta,
      color: "#f59e0b",
    };
  }
  // days === 6
  return {
    subject: "Tu plan vence en 6 días — CatalogoHoy",
    headline: "Tu plan vence en 6 días",
    body: autoRenews
      ? "En 6 días se cobra automáticamente la renovación de tu plan. Te avisamos por las dudas."
      : "Tu plan está por expirar en 6 días. Renovalo cuando puedas para mantener tu catálogo activo.",
    cta,
    color: "#0ea5e9",
  };
}

function renderEmail(
  cand: Candidate,
  days: Threshold
): { subject: string; html: string; text: string } {
  const autoRenews = cand.stripe_subscription_status === "active";
  const copy = copyForThreshold(days, autoRenews);
  const host = cand.custom_domain ?? `${cand.slug}.catalogohoy.com`;
  const plansUrl = `https://${host}/admin/plans`;

  const planLbl = planLabel(cand.plan_id);
  const greeting = cand.owner_name ? `Hola ${escape(cand.owner_name.split(" ")[0])},` : "Hola,";

  const html = brandEmail({
    title: copy.headline,
    subtitle: cand.tenant_name,
    bodyHtml: `<p style="margin:0 0 12px;">${greeting}</p>
<p style="margin:0 0 18px;">${escape(copy.body)}</p>
${brandRows([
  { label: "Catálogo", value: cand.tenant_name },
  { label: "Plan actual", value: planLbl },
  { label: "Vence el", value: formatDate(cand.plan_expires_at), color: copy.color },
])}`,
    buttons: [{ label: copy.cta, url: plansUrl }],
    footer: `Recibiste este email porque eres dueño del catálogo <strong>${escape(cand.tenant_name)}</strong>. Puedes desactivar estos avisos desde Mi Perfil → Notificaciones.`,
  });

  const text = [
    copy.headline,
    "",
    copy.body,
    "",
    `Catálogo: ${cand.tenant_name}`,
    `Plan: ${planLbl}`,
    `Vence: ${formatDate(cand.plan_expires_at)}`,
    "",
    `${copy.cta}: ${plansUrl}`,
  ].join("\n");

  return { subject: copy.subject, html, text };
}

async function logDebug(
  admin: ReturnType<typeof createClient>,
  msg: string
): Promise<void> {
  try {
    await admin
      .from("_debug_logs")
      .insert({ fn_name: "send-plan-expiry-warning", message: msg });
  } catch {
    /* noop */
  }
}

/** Aviso por WhatsApp vía send-whatsapp-notification (gate + logs propios de
 *  ese módulo). Devuelve true si el envío fue aceptado (sent o skipped). */
async function sendWhatsAppWarning(
  admin: ReturnType<typeof createClient>,
  cand: Candidate
): Promise<boolean> {
  const waSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
  if (!waSecret) return false;

  const { data: recipient } = await admin.rpc("resolve_billing_wa_recipient", {
    p_tenant_id: cand.tenant_id,
    p_type: "plan_expiring",
  });
  if (!recipient) return false;

  const firstName =
    (cand.owner_name ?? "").trim().split(" ")[0] || cand.tenant_name;

  try {
    const res = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": waSecret,
        },
        body: JSON.stringify({
          tenantId: cand.tenant_id,
          to: recipient,
          templateType: "plan_expiring",
          variables: [
            firstName,
            planLabel(cand.plan_id),
            formatDateShort(cand.plan_expires_at),
          ],
        }),
      }
    );
    const result = await res.json().catch(() => null);
    return res.ok && result?.success === true;
  } catch {
    return false;
  }
}

// Envío por AWS SES (v2 SendEmail, firma SigV4 con aws4fetch). Región
// sa-east-1, config set catalogohoy-prod (eventos → ses-events).
async function sendViaSes(to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; error?: string; status: number }> {
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
      FromEmailAddress: "CatalogoHoy <noreply@catalogohoy.com>",
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Secret del cron: env como override, Vault como fuente normal.
  let expectedSecret = Deno.env.get("PLAN_EXPIRY_WEBHOOK_SECRET") ?? null;
  if (!expectedSecret) {
    const { data } = await admin.rpc("internal_get_secret", {
      p_name: "plan_expiry_webhook_secret",
    });
    expectedSecret = (data as string | null) ?? null;
  }
  if (!expectedSecret || req.headers.get("x-webhook-secret") !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!Deno.env.get("AWS_SES_ACCESS_KEY_ID") || !Deno.env.get("AWS_SES_SECRET_ACCESS_KEY")) {
    await logDebug(admin, "Missing AWS_SES_* env vars");
    return new Response(JSON.stringify({ error: "Missing AWS_SES_ACCESS_KEY_ID / AWS_SES_SECRET_ACCESS_KEY" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const summary: Array<{
    tenantId: number;
    days: number;
    sent: boolean;
    whatsapp?: boolean;
    skipped?: string;
    error?: string;
  }> = [];

  for (const days of THRESHOLDS) {
    // We compare DATEs (not timestamps) so a plan whose expiry is at 02:00
    // UTC and a cron firing at 13:00 UTC still match the same "6 days from
    // now" bucket regardless of clock drift inside the same day.
    const { data: rows, error: rowsErr } = await admin.rpc(
      "plan_expiry_candidates",
      { p_days_before: days }
    );
    if (rowsErr) {
      await logDebug(admin, `RPC plan_expiry_candidates(${days}) failed: ${rowsErr.message}`);
      continue;
    }

    for (const cand of (rows ?? []) as Candidate[]) {
      if (!cand.notify_plan_expiry) {
        summary.push({ tenantId: cand.tenant_id, days, sent: false, skipped: "opted out" });
        continue;
      }
      // Free trial: la sub con tarjeta se cobra sola al terminar; NO es un
      // vencimiento a "renovar", así que no le mandamos el aviso.
      if (cand.stripe_subscription_status === "trialing") {
        summary.push({ tenantId: cand.tenant_id, days, sent: false, skipped: "trialing" });
        continue;
      }
      if (!cand.owner_email || !cand.owner_email.includes("@")) {
        summary.push({ tenantId: cand.tenant_id, days, sent: false, skipped: "no owner email" });
        continue;
      }

      // Idempotency check: if we already logged this exact (tenant, expiry,
      // days_before) tuple, the EMAIL was sent. El WhatsApp tiene su propia
      // marca (whatsapp_sent_at) para poder hacer catch-up sin re-emails.
      const { data: existing } = await admin
        .from("tenant_expiry_warnings")
        .select("id, whatsapp_sent_at")
        .eq("tenant_id", cand.tenant_id)
        .eq("plan_expires_at", cand.plan_expires_at)
        .eq("days_before", days)
        .maybeSingle();
      if (existing) {
        let wa = false;
        if (!(existing as { whatsapp_sent_at?: string | null }).whatsapp_sent_at) {
          wa = await sendWhatsAppWarning(admin, cand);
          if (wa) {
            await admin
              .from("tenant_expiry_warnings")
              .update({ whatsapp_sent_at: new Date().toISOString() })
              .eq("id", (existing as { id: number }).id);
          }
        }
        summary.push({ tenantId: cand.tenant_id, days, sent: false, whatsapp: wa, skipped: "already sent" });
        continue;
      }

      const { subject, html, text } = renderEmail(cand, days as Threshold);
      const sesRes = await sendViaSes(cand.owner_email, subject, html, text);

      if (!sesRes.ok) {
        await logDebug(admin, `SES ${sesRes.status} for tenant ${cand.tenant_id} (${days}d): ${sesRes.error}`);
        summary.push({ tenantId: cand.tenant_id, days, sent: false, error: sesRes.error });
        continue;
      }

      // WhatsApp junto al email (best-effort, no bloquea el flujo).
      const wa = await sendWhatsAppWarning(admin, cand);

      // Log AFTER the email is sent. If the INSERT fails because of a race
      // (the cron ran twice), we'd send twice — acceptable trade-off vs.
      // marking sent before sending and then having SES fail. The UNIQUE
      // constraint catches concurrent inserts.
      const { error: logErr } = await admin
        .from("tenant_expiry_warnings")
        .insert({
          tenant_id: cand.tenant_id,
          plan_expires_at: cand.plan_expires_at,
          days_before: days,
          recipient_email: cand.owner_email,
          whatsapp_sent_at: wa ? new Date().toISOString() : null,
        });
      if (logErr) {
        await logDebug(admin, `Log insert failed for tenant ${cand.tenant_id} (${days}d): ${logErr.message}`);
      }

      summary.push({ tenantId: cand.tenant_id, days, sent: true, whatsapp: wa });
    }
  }

  await logDebug(admin, `Summary: ${JSON.stringify(summary)}`);

  return new Response(JSON.stringify({ summary }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
