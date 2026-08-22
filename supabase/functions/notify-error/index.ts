import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Telemetría GENÉRICA de errores → canal de Slack de errores (el mismo de
// los eventos de import). La llama el front (fire-and-forget) desde dos
// ganchos centrales: el ErrorHandler global (errores no manejados, que
// también van a Sentry) y el parche de toast.error (todo error mostrado al
// usuario). También sirve para reportes server-side (source libre).
//
// A diferencia de notify-import-event acá se aceptan reportes SIN sesión
// (el catálogo público/checkout también rompe y eso importa): se etiquetan
// como "visitante". El front deduplica por mensaje y tope por sesión.
//
// Webhook: env SLACK_IMPORT_EVENTS_WEBHOOK (override) o el secret
// `slack_import_events_webhook` en Supabase Vault (RPC internal_get_secret).

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

const SOURCE_LABELS: Record<string, string> = {
  uncaught: "🧨 Error no manejado (front)",
  toast: "🟥 Error mostrado al usuario",
  email: "📧 Error de email",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  // Usuario si hay sesión; los visitantes anónimos también pueden reportar
  // (errores del catálogo público) — se etiquetan como visitante.
  let userLabel = "visitante (sin sesión)";
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userLabel = user.email ?? user.id;
    } catch {
      /* queda como visitante */
    }
  }

  let body: {
    source?: string;
    message?: string;
    detail?: string;
    slug?: string;
    url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  const source = String(body.source ?? "error").slice(0, 40);
  const message = String(body.message ?? "").slice(0, 500);
  const detail = String(body.detail ?? "").slice(0, 1000);
  const slug = String(body.slug ?? "").slice(0, 80);
  const url = String(body.url ?? "").slice(0, 300);
  if (!message) {
    return jsonResponse({ success: false, error: "message requerido" }, 400);
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
    console.log("webhook de Slack no configurado; reporte ignorado");
    return jsonResponse({ success: true, skipped: true });
  }

  const title = SOURCE_LABELS[source] ?? `⚪ ${source}`;
  const fields = [
    { type: "mrkdwn", text: `*Tienda:*\n${slug ? `<https://${slug}.catalogohoy.com|${slug}>` : "—"}` },
    { type: "mrkdwn", text: `*Usuario:*\n${userLabel}` },
  ];
  if (url) {
    fields.push({ type: "mrkdwn", text: `*URL:*\n${url}` });
  }

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
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Error:*\n${message}` },
          },
          ...(detail
            ? [{
              type: "section",
              text: { type: "mrkdwn", text: `\`\`\`${detail}\`\`\`` },
            }]
            : []),
          {
            type: "context",
            elements: [{
              type: "mrkdwn",
              text: `notify-error · ${new Date().toISOString()}`,
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
