import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ============================================================================
// send-customer-success (CAT-48) — motor de disparo de plantillas de ciclo de
// vida (CatalogoHoy → comerciante). Corre por cron.
//
// Primera condición: order_pending_reminder — pedidos pending 2–30 días sin
// recordatorio previo (candidatos vía RPC customer_success_order_pending_
// candidates). Canal: WhatsApp (template aprobado, best-effort si hay número)
// + email (Resend, siempre que haya email). Idempotencia: 1 fila por evento en
// customer_success_sends (event_key único).
//
// Auth del cron: x-webhook-secret contra el secret `customer_success_webhook_
// secret` en Vault (o env CUSTOMER_SUCCESS_WEBHOOK_SECRET como override).
//
// Params opcionales (body JSON) para el rollout controlado:
//   { onlyOrderId?: number, limit?: number, record?: boolean, sendEmail?: boolean, dryRun?: boolean }
//   - onlyOrderId: procesa solo esa orden (test en demo).
//   - limit: procesa solo los N candidatos más recientes (rollout por sublotes).
//   - record=false: no marca idempotencia (para re-testear).
//   - dryRun=true: no envía nada, solo devuelve los candidatos.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface PendingCandidate {
  order_id: number;
  order_number: number | null;
  tenant_id: number;
  catalog_name: string;
  slug: string;
  owner_name: string | null;
  owner_email: string | null;
  product_name: string;
  days_pending: number;
  wa_recipient: string | null;
}

function firstNameOf(name: string | null, fallback: string): string {
  const n = (name ?? "").trim().split(/\s+/)[0];
  return n || fallback;
}

function daysLabel(days: number): string {
  const d = Math.max(1, days);
  return d === 1 ? "1 día" : `${d} días`;
}

function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPendingEmail(c: PendingCandidate): {
  subject: string;
  html: string;
  text: string;
} {
  const first = firstNameOf(c.owner_name, c.catalog_name);
  const orderUrl = `https://catalogohoy.com/o/${c.order_id}`;
  const timePending = daysLabel(c.days_pending);
  const subject = "Tienes un pedido pendiente — CatalogoHoy";

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;padding:24px 12px;"><tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
<tr><td style="background:#10b981;padding:28px 24px;text-align:center;">
  <p style="margin:0;font-size:22px;">🛒</p>
  <h1 style="margin:10px 0 2px;font-size:18px;font-weight:700;color:#ffffff;">Tienes un pedido esperando</h1>
  <p style="margin:0;font-size:13px;color:#ffffffcc;">CatalogoHoy</p>
</td></tr>
<tr><td style="padding:30px 24px;">
  <p style="margin:0 0 12px;font-size:15px;color:#1e293b;">Hola ${escapeHtml(first)} 👋</p>
  <p style="margin:0 0 22px;font-size:14px;color:#475569;line-height:1.6;">
    Tienes un pedido de <strong>${escapeHtml(c.product_name)}</strong> en
    <strong>${escapeHtml(c.catalog_name)}</strong> que sigue pendiente desde hace
    <strong>${escapeHtml(timePending)}</strong>. Un cliente esperando es una venta
    a punto de cerrarse — revísalo y confírmalo antes de que se enfríe. 👇
  </p>
  <div style="text-align:center;margin:8px 0;">
    <a href="${escapeHtml(orderUrl)}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:14px 30px;border-radius:12px;">Ver el pedido →</a>
  </div>
</td></tr>
<tr><td style="padding:18px 24px;text-align:center;background:#f8fafc;border-top:1px solid #f1f5f9;">
  <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
    Recibiste este email porque tienes un pedido pendiente en tu catálogo
    <strong>${escapeHtml(c.catalog_name)}</strong>.<br>
    CatalogoHoy · <a href="https://catalogohoy.com" style="color:#94a3b8;">catalogohoy.com</a>
  </p>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `Hola ${first} 👋`,
    "",
    `Tienes un pedido de ${c.product_name} en ${c.catalog_name} que sigue pendiente desde hace ${timePending}.`,
    "Revísalo y confírmalo antes de que se enfríe.",
    "",
    `Ver el pedido: ${orderUrl}`,
  ].join("\n");

  return { subject, html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: env override, Vault como fuente normal (repo público → nada hardcodeado).
  let expectedSecret = Deno.env.get("CUSTOMER_SUCCESS_WEBHOOK_SECRET") ?? null;
  if (!expectedSecret) {
    const { data } = await admin.rpc("internal_get_secret", {
      p_name: "customer_success_webhook_secret",
    });
    expectedSecret = (data as string | null) ?? null;
  }
  if (!expectedSecret || req.headers.get("x-webhook-secret") !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let opts: {
    onlyOrderId?: number;
    limit?: number;
    record?: boolean;
    sendEmail?: boolean;
    dryRun?: boolean;
  } = {};
  try {
    opts = req.method === "POST" ? await req.json() : {};
  } catch {
    opts = {};
  }
  const record = opts.record !== false;
  const sendEmail = opts.sendEmail !== false;

  const waSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // --- Condición 1: order_pending_reminder ---
  const { data: rows, error } = await admin.rpc(
    "customer_success_order_pending_candidates",
  );
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let candidates = (rows ?? []) as PendingCandidate[];
  // Más recientes primero (order_id como proxy de recencia) para los sublotes.
  candidates.sort((a, b) => b.order_id - a.order_id);
  if (opts.onlyOrderId) {
    candidates = candidates.filter((c) => c.order_id === opts.onlyOrderId);
  }
  if (opts.limit && opts.limit > 0) {
    candidates = candidates.slice(0, opts.limit);
  }

  if (opts.dryRun) {
    return new Response(
      JSON.stringify({ dryRun: true, count: candidates.length, candidates }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const summary: Array<{
    orderId: number;
    tenantId: number;
    whatsapp: boolean;
    email: boolean;
    recorded: boolean;
  }> = [];

  for (const c of candidates) {
    const first = firstNameOf(c.owner_name, c.catalog_name);
    let waOk = false;
    let emailOk = false;

    // WhatsApp (best-effort: solo si hay número resolvible + secret).
    if (waSecret && c.wa_recipient) {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/send-whatsapp-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-secret": waSecret,
            },
            body: JSON.stringify({
              tenantId: c.tenant_id,
              to: c.wa_recipient,
              templateType: "order_pending_reminder",
              variables: [
                first,
                c.product_name,
                c.catalog_name,
                daysLabel(c.days_pending),
              ],
              urlButtonParam: String(c.order_id),
            }),
          },
        );
        const j = await res.json().catch(() => null);
        waOk = res.ok && j?.success === true && !j?.skipped;
      } catch {
        waOk = false;
      }
    }

    // Email (siempre que haya email + Resend).
    if (sendEmail && resendKey && c.owner_email && c.owner_email.includes("@")) {
      try {
        const { subject, html, text } = renderPendingEmail(c);
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "CatalogoHoy <noreply@catalogohoy.com>",
            to: [c.owner_email],
            subject,
            html,
            text,
          }),
        });
        emailOk = res.ok;
      } catch {
        emailOk = false;
      }
    }

    // Idempotencia: registrar el evento si al menos un canal salió.
    let recorded = false;
    if (record && (waOk || emailOk)) {
      const channel = waOk && emailOk ? "both" : waOk ? "whatsapp" : "email";
      const { error: insErr } = await admin
        .from("customer_success_sends")
        .insert({
          tenant_id: c.tenant_id,
          event_key: `order_pending:${c.order_id}`,
          channel,
          recipient: c.wa_recipient ?? c.owner_email,
        });
      recorded = !insErr;
    }

    summary.push({
      orderId: c.order_id,
      tenantId: c.tenant_id,
      whatsapp: waOk,
      email: emailOk,
      recorded,
    });
  }

  return new Response(
    JSON.stringify({ condition: "order_pending_reminder", sent: summary.length, summary }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
