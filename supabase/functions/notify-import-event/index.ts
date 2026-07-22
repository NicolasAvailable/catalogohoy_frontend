import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Telemetría de soporte: el admin avisa a Slack cuando un import (Excel /
// Sheets / PDF / fotos) falla — o cuando un import de PDF termina bien
// (señal de adopción). Fire-and-forget desde el front: NUNCA debe romper
// el flujo del cliente; si el webhook no está configurado, no-op.
//
// Webhook del canal: env SLACK_IMPORT_EVENTS_WEBHOOK (override) o el secret
// `slack_import_events_webhook` en Supabase Vault (vía RPC internal_get_secret,
// solo service_role) — mismo patrón que whatsapp_webhook_secret.

const WEBHOOK_ENV = Deno.env.get("SLACK_IMPORT_EVENTS_WEBHOOK");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Eventos con emoji/título amigable; cualquier otro sale genérico. */
const EVENT_LABELS: Record<string, string> = {
  "pdf-import-error": "🔴 Error leyendo PDF",
  "pdf-import-timeout": "🔴 PDF colgado (watchdog)",
  "pdf-ia-error": "🔴 IA falló leyendo el PDF",
  "excel-parse-error": "🔴 Error leyendo Excel/Sheets",
  "excel-ia-error": "🔴 IA falló mapeando Excel",
  "import-rows-error": "🟠 Import con filas fallidas",
  "backup-error": "🔴 Falló el respaldo pre-import",
  "fotos-ia-error": "🔴 IA falló identificando fotos",
  "fotos-error": "🟠 Fotos con errores al aplicar",
  "pdf-import-ok": "🟢 Import de PDF completado",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  // Solo usuarios logueados pueden emitir (evita spam anónimo al canal).
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let webhook = WEBHOOK_ENV ?? null;
  if (!webhook) {
    const { data } = await admin.rpc("internal_get_secret", {
      p_name: "slack_import_events_webhook",
    });
    webhook = (data as string | null) ?? null;
  }
  if (!webhook) {
    console.log("webhook de Slack no configurado (env ni Vault); evento ignorado");
    return jsonResponse({ success: true, skipped: true });
  }

  let body: { event?: string; detail?: string; slug?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  const event = String(body.event ?? "").slice(0, 60);
  const detail = String(body.detail ?? "").slice(0, 500);
  const slug = String(body.slug ?? "").slice(0, 80);
  if (!event) {
    return jsonResponse({ success: false, error: "event requerido" }, 400);
  }

  const title = EVENT_LABELS[event] ?? `⚪ ${event}`;
  const fields = [
    { type: "mrkdwn", text: `*Tienda:*\n${slug ? `<https://${slug}.catalogohoy.com|${slug}>` : "—"}` },
    { type: "mrkdwn", text: `*Usuario:*\n${user.email ?? user.id}` },
  ];

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: title, emoji: true },
          },
          { type: "section", fields },
          ...(detail
            ? [{
              type: "section",
              text: { type: "mrkdwn", text: `*Detalle:*\n${detail}` },
            }]
            : []),
          {
            type: "context",
            elements: [{
              type: "mrkdwn",
              text: `Import hub · ${new Date().toISOString()}`,
            }],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("slack webhook error:", res.status, await res.text());
    }
  } catch (e) {
    console.error("slack webhook fetch failed:", e);
  }

  // Siempre 200: la telemetría jamás debe hacer fallar al caller.
  return jsonResponse({ success: true });
});
