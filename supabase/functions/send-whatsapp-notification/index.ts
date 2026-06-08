import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// W2 — Envío de notificaciones vía Meta WhatsApp Cloud API.
// Brief: https://linear.app/catalogo-hoy/document/brief-notificaciones-whatsapp-74d716883654
// Issue: CAT-14. La invocan server-to-server (trigger de orders CAT-16, cron CAT-18),
// por eso autentica con x-webhook-secret en vez del JWT de usuario.

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const WHATSAPP_WEBHOOK_SECRET = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Meta espera el destino en E.164 sólo dígitos (sin '+', espacios ni guiones).
// La orden guarda phone como "+58 4141234567" → lo normalizamos.
function toE164Digits(raw: string): string {
  return raw.replace(/\D/g, "");
}

type Payload = {
  tenantId: number;
  to: string;
  templateType:
    | "order_received"
    | "order_completed"
    | "plan_expiring"
    | "payment_failed";
  // Parámetros posicionales del body del template aprobado ({{1}}, {{2}}, ...).
  variables?: string[];
  // Valor del botón URL dinámico (índice 0), p.ej. el order id para `/o/{{1}}`.
  urlButtonParam?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1) Auth server-to-server.
  if (
    !WHATSAPP_WEBHOOK_SECRET ||
    req.headers.get("x-webhook-secret") !== WHATSAPP_WEBHOOK_SECRET
  ) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.error("WhatsApp Cloud API env vars not configured");
    return jsonResponse(
      { success: false, error: "WhatsApp not configured" },
      500,
    );
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  const { tenantId, to, templateType, variables = [], urlButtonParam } = body;
  if (!tenantId || !to || !templateType) {
    return jsonResponse(
      { success: false, error: "Missing tenantId, to or templateType" },
      400,
    );
  }

  const phone = toE164Digits(to);
  if (phone.length < 8) {
    return jsonResponse({ success: false, error: "Invalid phone" }, 400);
  }

  // 2) Resolver la config del tenant (template + enabled) con service role.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: setting, error: settingError } = await admin
    .from("whatsapp_notification_settings")
    .select("enabled, meta_template_name, language_code")
    .eq("tenant_id", tenantId)
    .eq("type", templateType)
    .maybeSingle();

  if (settingError) {
    console.error("settings lookup error:", settingError.message);
    return jsonResponse({ success: false, error: "settings lookup failed" }, 500);
  }

  // Sin config o deshabilitado → skip silencioso (no es un error).
  if (!setting || !setting.enabled) {
    return jsonResponse({ success: true, skipped: true });
  }

  // 3) Enviar el template vía Meta Cloud API.
  const metaUrl =
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const components: Record<string, unknown>[] = [];
  if (variables.length) {
    components.push({
      type: "body",
      parameters: variables.map((text) => ({ type: "text", text })),
    });
  }
  // Botón URL dinámico (índice 0): el valor se appendea a la base fija del template.
  if (urlButtonParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: urlButtonParam }],
    });
  }

  const metaPayload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: setting.meta_template_name,
      language: { code: setting.language_code ?? "es" },
      components,
    },
  };

  try {
    const res = await fetch(metaUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaPayload),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Meta API error:", res.status, JSON.stringify(result));
      return jsonResponse(
        { success: false, status: res.status, error: result?.error ?? result },
        502,
      );
    }

    return jsonResponse({
      success: true,
      messageId: result?.messages?.[0]?.id ?? null,
    });
  } catch (err) {
    console.error("send-whatsapp-notification error:", err);
    return jsonResponse({ success: false, error: String(err) }, 500);
  }
});
