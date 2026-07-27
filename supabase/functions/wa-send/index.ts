import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// wa-send — envío SALIENTE de respuestas del agente (CRM → cliente) vía Meta
// WhatsApp Cloud API.
//
// El inbox (chat.service.sendMessage) antes sólo insertaba en chat_messages, así
// que el cliente NUNCA recibía la respuesta. Esta función:
//   1. Verifica que el agente es miembro del tenant dueño del chat (RLS).
//   2. Envía un mensaje de texto libre por la Cloud API (ventana de servicio 24h).
//   3. Persiste el mensaje en chat_messages (is_mine=true) + actualiza el chat.
//
// Texto libre: sólo funciona dentro de la ventana de 24h desde el último mensaje
// del cliente. Fuera de ella Meta devuelve error (#131047) → lo propagamos para
// que la UI pida usar una plantilla. Deploy con verify_jwt=true (lo llama el
// agente autenticado desde el CRM).
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
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

// Meta espera el destino en E.164 sólo dígitos (sin '+', espacios ni guiones).
function toE164Digits(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

type Payload = {
  chatId: number;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "document";
  replyToMessageId?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method Not Allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  const chatId = Number(body.chatId);
  const text = (body.text ?? "").trim();
  const mediaUrl = (body.mediaUrl ?? "").trim();
  const mediaType = body.mediaType === "document" ? "document" : "image";
  if (!chatId || (!text && !mediaUrl)) {
    return jsonResponse({ success: false, error: "Missing chatId or content" }, 400);
  }

  // 1) Autorización: cliente con el JWT del agente. RLS sólo deja leer el chat si
  //    es miembro del tenant → confirma permiso sin lógica extra.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: chat, error: chatErr } = await userClient
    .from("chats")
    .select("id, tenant_id, customer_phone")
    .eq("id", chatId)
    .maybeSingle();

  if (chatErr) {
    console.error("chat lookup error:", chatErr.message);
    return jsonResponse({ success: false, error: "chat lookup failed" }, 500);
  }
  if (!chat) {
    return jsonResponse({ success: false, error: "Chat not found or forbidden" }, 403);
  }

  const to = toE164Digits(chat.customer_phone ?? "");
  if (to.length < 8) {
    return jsonResponse({ success: false, error: "Invalid customer phone" }, 400);
  }

  // 2) Resolver la cuenta de WhatsApp DEL COMERCIANTE (su phone_number_id + su
  //    token). En el modelo BSP cada tenant envía desde su propio número.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: account } = await admin
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("tenant_id", chat.tenant_id)
    .eq("status", "active")
    .not("phone_number_id", "is", null)
    .maybeSingle();

  const phoneNumberId = account?.phone_number_id;
  const token = account?.access_token;
  if (!phoneNumberId || !token) {
    return jsonResponse(
      {
        success: false,
        error: "El comerciante no tiene un número de WhatsApp conectado",
      },
      409,
    );
  }

  // Respuesta citada: resolvemos el wamid del mensaje al que se responde.
  const replyToId = Number(body.replyToMessageId) || null;
  let contextWamid: string | null = null;
  if (replyToId) {
    const { data: quoted } = await admin
      .from("chat_messages")
      .select("wa_message_id")
      .eq("id", replyToId)
      .maybeSingle();
    contextWamid = quoted?.wa_message_id ?? null;
  }

  // 3) Enviar por la Cloud API con el token del comerciante: texto libre, o
  //    imagen/documento por `link` (con caption opcional = text). Si hay cita,
  //    se agrega `context.message_id`.
  const metaUrl =
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  const metaPayload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    ...(contextWamid ? { context: { message_id: contextWamid } } : {}),
    ...(mediaUrl
      ? { type: mediaType, [mediaType]: { link: mediaUrl, ...(text ? { caption: text } : {}) } }
      : { type: "text", text: { body: text } }),
  };

  let messageId: string | null = null;
  try {
    const res = await fetch(metaUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaPayload),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("Meta API error:", res.status, JSON.stringify(result));
      // 131047 = fuera de la ventana de servicio de 24h → requiere plantilla.
      return jsonResponse(
        { success: false, status: res.status, error: result?.error ?? result },
        502,
      );
    }
    messageId = result?.messages?.[0]?.id ?? null;
  } catch (err) {
    console.error("wa-send fetch error:", err);
    return jsonResponse({ success: false, error: String(err) }, 500);
  }

  // 4) Persistir el mensaje enviado + actualizar el chat (service role).
  const persistContent = text ||
    (mediaUrl ? (mediaType === "document" ? "📎 Documento" : "📷 Imagen") : "");
  const { data: inserted, error: insErr } = await admin
    .from("chat_messages")
    .insert({
      chat_id: chatId,
      content: persistContent,
      is_mine: true,
      message_type: mediaUrl ? mediaType : "text",
      media_url: mediaUrl || null,
      wa_message_id: messageId,
      reply_to_message_id: replyToId,
      delivery_status: "sent",
    })
    .select()
    .single();

  if (insErr) {
    console.error("chat_messages insert error:", insErr.message);
    // El mensaje SÍ se envió; informamos pero no como fallo total.
    return jsonResponse(
      { success: true, messageId, persisted: false, error: insErr.message },
      200,
    );
  }

  await admin
    .from("chats")
    .update({
      last_message: persistContent,
      last_message_at: new Date().toISOString(),
      last_message_is_mine: true,
    })
    .eq("id", chatId);

  return jsonResponse({ success: true, messageId, message: inserted });
});
