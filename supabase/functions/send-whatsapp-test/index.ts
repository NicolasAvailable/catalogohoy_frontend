import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Envía una notificación WhatsApp de PRUEBA (template `order_received` con datos
// de ejemplo) al número que el tenant está configurando. A diferencia de
// `send-whatsapp-notification` (server-to-server, x-webhook-secret), esta la
// llama el frontend con el JWT del usuario → autentica al usuario logueado.

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";

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

function toE164Digits(raw: string): string {
  return raw.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: usuario logueado (JWT).
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

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return jsonResponse({ success: false, error: "WhatsApp no configurado" });
  }

  let body: { to?: string; tenantName?: string; tenantId?: number };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  const phone = toE164Digits(body.to ?? "");
  if (phone.length < 8) {
    return jsonResponse({ success: false, error: "Número inválido" });
  }

  const catalogName = (body.tenantName ?? "").trim() || "Tu catálogo";

  // Para que el botón "Ver pedido" del test abra una orden real, usamos la
  // última orden del tenant (RLS permite leerla al miembro logueado). Si no
  // hay órdenes, el botón apunta a "0" (la landing muestra "no encontrado").
  let buttonOrderId = "0";
  if (body.tenantId) {
    const { data: lastOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("tenant_id", body.tenantId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastOrder?.id) buttonOrderId = String(lastOrder.id);
  }

  // Mismo template real `order_received` con datos de ejemplo.
  const metaPayload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: "order_received",
      language: { code: "es" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: catalogName },
            { type: "text", text: "Cliente de prueba" },
            { type: "text", text: "+58 412 1234567" },
            { type: "text", text: "Producto de prueba x1" },
            { type: "text", text: "$10,00" },
          ],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: buttonOrderId }],
        },
      ],
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaPayload),
      },
    );
    const result = await res.json();
    if (!res.ok) {
      console.error("Meta API error:", res.status, JSON.stringify(result));
      // 200 con success:false para que el frontend pueda mostrar el motivo.
      return jsonResponse({
        success: false,
        error: result?.error?.message ?? "No se pudo enviar el mensaje de prueba",
      });
    }
    return jsonResponse({
      success: true,
      messageId: result?.messages?.[0]?.id ?? null,
    });
  } catch (err) {
    console.error("send-whatsapp-test error:", err);
    return jsonResponse({ success: false, error: String(err) });
  }
});
