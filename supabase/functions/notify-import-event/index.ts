import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Telemetría de soporte: el admin avisa a Slack cuando un import (Excel /
// Sheets / PDF / fotos) falla — o cuando un import de PDF termina bien
// (señal de adopción) — y deja traza en la tabla `catalog_imports` (con el
// archivo que el front subió a imports/<slug>/ en el bucket) para poder
// reproducir el caso. Fire-and-forget desde el front: NUNCA debe romper
// el flujo del cliente; si el webhook no está configurado, la traza en la
// tabla se guarda igual y solo se saltea Slack.
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

function asCount(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** catalog_imports.status tiene CHECK (success|partial|failed); el evento
 *  crudo va aparte en la columna `event`. */
function mapStatus(event: string): "success" | "partial" | "failed" {
  if (event === "pdf-import-ok") return "success";
  if (event === "import-rows-error" || event === "fotos-error") return "partial";
  return "failed";
}

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

  let body: {
    event?: string;
    detail?: string;
    slug?: string;
    fileName?: string;
    fileUrl?: string;
    pages?: number;
    products?: number;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  const event = String(body.event ?? "").slice(0, 60);
  const detail = String(body.detail ?? "").slice(0, 500);
  const slug = String(body.slug ?? "").slice(0, 80);
  const fileName = String(body.fileName ?? "").slice(0, 200);
  const fileUrl = String(body.fileUrl ?? "").slice(0, 500);
  const pageCount = asCount(body.pages);
  const productCount = asCount(body.products);
  if (!event) {
    return jsonResponse({ success: false, error: "event requerido" }, 400);
  }

  // ── Traza en catalog_imports (best-effort, ANTES de Slack para que se
  //    guarde aunque el webhook falte o falle). tenant_id es NOT NULL: sin
  //    slug resoluble no hay fila, pero Slack avisa igual. ─────────────
  try {
    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    const tenantId = (tenant as { id?: number } | null)?.id;
    if (tenantId) {
      const { error: insertError } = await admin.from("catalog_imports").insert({
        tenant_id: tenantId,
        created_by: user.id,
        file_name: fileName || null,
        file_url: fileUrl, // NOT NULL: '' cuando el evento no trae archivo
        page_count: pageCount,
        product_count: productCount,
        status: mapStatus(event),
        event,
        detail: detail || null,
      });
      if (insertError) {
        console.error("catalog_imports insert error:", insertError);
      }
    } else {
      console.warn("catalog_imports: tenant no resuelto para slug:", slug);
    }
  } catch (e) {
    console.error("catalog_imports insert failed:", e);
  }

  // ── Slack ──────────────────────────────────────────────────────────
  let webhook = WEBHOOK_ENV ?? null;
  if (!webhook) {
    const { data } = await admin.rpc("internal_get_secret", {
      p_name: "slack_import_events_webhook",
    });
    webhook = (data as string | null) ?? null;
  }
  if (!webhook) {
    console.log("webhook de Slack no configurado (env ni Vault); solo traza");
    return jsonResponse({ success: true, skipped: true });
  }

  const title = EVENT_LABELS[event] ?? `⚪ ${event}`;
  const fields = [
    { type: "mrkdwn", text: `*Tienda:*\n${slug ? `<https://${slug}.catalogohoy.com|${slug}>` : "—"}` },
    { type: "mrkdwn", text: `*Usuario:*\n${user.email ?? user.id}` },
  ];
  if (fileUrl || fileName) {
    fields.push({
      type: "mrkdwn",
      text: `*Archivo:*\n${fileUrl ? `<${fileUrl}|${fileName || "descargar"}>` : fileName}`,
    });
  }
  if (pageCount !== null || productCount !== null) {
    const parts = [
      ...(pageCount !== null ? [`${pageCount} págs`] : []),
      ...(productCount !== null ? [`${productCount} productos`] : []),
    ];
    fields.push({ type: "mrkdwn", text: `*Tamaño:*\n${parts.join(" · ")}` });
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
