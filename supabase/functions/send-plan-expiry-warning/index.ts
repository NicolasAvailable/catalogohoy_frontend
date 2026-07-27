import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Cron diario (13:00 UTC, pg_cron `send-plan-expiry-warnings-daily`): avisa a
// los dueños que su plan vence en 6/4/2/0 días.
// - EMAIL (Resend): idempotencia por fila en tenant_expiry_warnings.
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
  const themeColor = cand.theme_color || "#10b981";
  const host = cand.custom_domain ?? `${cand.slug}.catalogohoy.com`;
  const plansUrl = `https://${host}/admin/plans`;

  const headerInner = cand.logo
    ? `<img src="${escape(cand.logo)}" alt="${escape(cand.tenant_name)}" width="56" height="56" style="display:inline-block;border-radius:50%;border:3px solid #ffffff;background:#ffffff;" />`
    : `<div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:#ffffff33;line-height:56px;font-weight:700;font-size:22px;color:#ffffff;">${escape(cand.tenant_name.charAt(0))}</div>`;

  const planLbl = planLabel(cand.plan_id);
  const greeting = cand.owner_name ? `Hola ${escape(cand.owner_name.split(" ")[0])},` : "Hola,";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escape(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
<tr><td style="background:${themeColor};padding:32px 24px;text-align:center;">
  ${headerInner}
  <h1 style="margin:16px 0 4px;font-size:18px;font-weight:700;color:#ffffff;">${escape(cand.tenant_name)}</h1>
  <p style="margin:0;font-size:13px;color:#ffffffcc;">CatalogoHoy</p>
</td></tr>
<tr><td style="padding:32px 24px;">
  <div style="background:${copy.color}1A;border-left:4px solid ${copy.color};border-radius:8px;padding:14px 16px;margin-bottom:24px;">
    <p style="margin:0;font-size:18px;font-weight:700;color:${copy.color};">${escape(copy.headline)}</p>
  </div>

  <p style="margin:0 0 12px;font-size:15px;color:#1e293b;">${greeting}</p>
  <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">${escape(copy.body)}</p>

  <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:24px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#94a3b8;">Catálogo</td>
        <td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:600;text-align:right;">${escape(cand.tenant_name)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#94a3b8;">Plan actual</td>
        <td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:600;text-align:right;">${escape(planLbl)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#94a3b8;">Vence el</td>
        <td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:600;text-align:right;">${escape(formatDate(cand.plan_expires_at))}</td>
      </tr>
    </table>
  </div>

  <div style="text-align:center;margin:24px 0 8px;">
    <a href="${escape(plansUrl)}" style="display:inline-block;background:${themeColor};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:14px 28px;border-radius:12px;">${escape(copy.cta)} →</a>
  </div>
</td></tr>
<tr><td style="padding:20px 24px;text-align:center;background:#f8fafc;border-top:1px solid #f1f5f9;">
  <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
    Recibíste este email porque sos dueño del catálogo <strong>${escape(cand.tenant_name)}</strong>.<br>
    Podés desactivar estos avisos desde Mi Perfil → Notificaciones.<br>
    CatalogoHoy · <a href="https://catalogohoy.com" style="color:#94a3b8;">catalogohoy.com</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

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

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    await logDebug(admin, "Missing RESEND_API_KEY env var");
    return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
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
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "CatalogoHoy <noreply@catalogohoy.com>",
          to: [cand.owner_email],
          subject,
          html,
          text,
        }),
      });

      if (!resendRes.ok) {
        const errText = await resendRes.text();
        await logDebug(admin, `Resend ${resendRes.status} for tenant ${cand.tenant_id} (${days}d): ${errText}`);
        summary.push({ tenantId: cand.tenant_id, days, sent: false, error: errText });
        continue;
      }

      // WhatsApp junto al email (best-effort, no bloquea el flujo).
      const wa = await sendWhatsAppWarning(admin, cand);

      // Log AFTER the email is sent. If the INSERT fails because of a race
      // (the cron ran twice), we'd send twice — acceptable trade-off vs.
      // marking sent before sending and then having Resend fail. The UNIQUE
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
