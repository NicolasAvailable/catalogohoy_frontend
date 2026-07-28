import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// fb-send — respuesta del agente por Messenger (CRM → cliente), espejo de
// ig-send. Envía con el PAGE ACCESS TOKEN del tenant (social_accounts,
// channel='messenger') vía la Graph API de Facebook: POST /me/messages.
//
// Ventana de 24h: Messenger solo permite texto libre dentro de las 24h del
// último mensaje del cliente (fuera de eso se necesita un message tag) → el
// error de Meta se propaga claro. Media: imagen por URL (attachment).
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GRAPH = "https://graph.facebook.com/v23.0";

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

type Payload = {
  chatId: number;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image";
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
  if (!chatId || (!text && !mediaUrl)) {
    return jsonResponse({ success: false, error: "Missing chatId or content" }, 400);
  }
  if (text.length > 2000) {
    return jsonResponse(
      { success: false, error: "Messenger permite máximo 2000 caracteres por mensaje" },
      400,
    );
  }

  // 1) Autorización vía RLS: el agente solo puede leer chats de su tenant.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: chat, error: chatErr } = await userClient
    .from("chats")
    .select("id, tenant_id, channel, external_user_id")
    .eq("id", chatId)
    .maybeSingle();
  if (chatErr) {
    console.error("chat lookup error:", chatErr.message);
    return jsonResponse({ success: false, error: "chat lookup failed" }, 500);
  }
  if (!chat) {
    return jsonResponse({ success: false, error: "Chat not found or forbidden" }, 403);
  }
  if (chat.channel !== "messenger" || !chat.external_user_id) {
    return jsonResponse({ success: false, error: "El chat no es de Messenger" }, 400);
  }

  // 2) Page access token del tenant (service role — RLS oculta los tokens).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: account } = await admin
    .from("social_accounts")
    .select("access_token")
    .eq("tenant_id", chat.tenant_id)
    .eq("channel", "messenger")
    .eq("status", "active")
    .maybeSingle();
  const token = account?.access_token;
  if (!token) {
    return jsonResponse(
      { success: false, error: "El comerciante no tiene Messenger conectado" },
      409,
    );
  }

  // 2b) Modo DEMO: si el page token tiene prefijo "DEMO-" (catálogo de
  //     demostración, sin Página real), no se llama a la Graph API — se inserta
  //     directo para poder mostrar respuestas del agente en el video/demo.
  if (token.startsWith("DEMO-")) {
    const persistContent = text || "📷 Imagen";
    const { data: inserted, error: insErr } = await admin
      .from("chat_messages")
      .insert({
        chat_id: chatId,
        content: persistContent,
        is_mine: true,
        message_type: mediaUrl ? "image" : "text",
        media_url: mediaUrl || null,
        delivery_status: "sent",
      })
      .select()
      .single();
    if (insErr) {
      return jsonResponse({ success: false, error: insErr.message }, 500);
    }
    await admin
      .from("chats")
      .update({
        last_message: persistContent,
        last_message_at: new Date().toISOString(),
        last_message_is_mine: true,
      })
      .eq("id", chatId);
    return jsonResponse({ success: true, messageId: null, message: inserted });
  }

  // 3) Enviar por la Graph API de Facebook (Send API).
  const message = mediaUrl
    ? { attachment: { type: "image", payload: { url: mediaUrl, is_reusable: true } } }
    : { text };
  let messageId: string | null = null;
  try {
    const res = await fetch(`${GRAPH}/me/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: chat.external_user_id },
        messaging_type: "RESPONSE",
        message,
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("FB API error:", res.status, JSON.stringify(result));
      const fbError = result?.error?.message ?? "No se pudo enviar el mensaje";
      // Fuera de la ventana de 24h → mensaje claro para la UI.
      const friendly =
        String(fbError).includes("outside of allowed window") ||
        String(fbError).includes("24h") ||
        result?.error?.code === 10
          ? "Fuera de la ventana de 24h: en Messenger solo puedes responder hasta 24h después del último mensaje del cliente."
          : fbError;
      return jsonResponse({ success: false, error: friendly }, 502);
    }
    messageId = result?.message_id ?? null;
  } catch (err) {
    console.error("fb-send fetch error:", err);
    return jsonResponse({ success: false, error: String(err) }, 500);
  }

  // 4) Persistir + actualizar preview (mismo contrato que wa-send / ig-send).
  const persistContent = text || "📷 Imagen";
  const { data: inserted, error: insErr } = await admin
    .from("chat_messages")
    .insert({
      chat_id: chatId,
      content: persistContent,
      is_mine: true,
      message_type: mediaUrl ? "image" : "text",
      media_url: mediaUrl || null,
      wa_message_id: messageId,
      delivery_status: "sent",
    })
    .select()
    .single();

  if (insErr) {
    console.error("chat_messages insert error:", insErr.message);
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
