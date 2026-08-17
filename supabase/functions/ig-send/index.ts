import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// ig-send — respuesta del agente por Instagram DM (CRM → cliente), espejo de
// wa-send. Envía con el token DEL TENANT (social_accounts) vía la API de
// Instagram (Instagram Login): POST /v23.0/me/messages.
//
// Ventana de 24h: solo se puede responder dentro de las 24h del último mensaje
// del cliente (IG no tiene plantillas) → el error de Meta se propaga claro.
// Texto: máximo 1000 caracteres (límite de IG). Media: imagen por URL.
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GRAPH = "https://graph.instagram.com/v23.0";

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
  if (text.length > 1000) {
    return jsonResponse(
      { success: false, error: "Instagram permite máximo 1000 caracteres por mensaje" },
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
  if (chat.channel !== "instagram" || !chat.external_user_id) {
    return jsonResponse({ success: false, error: "El chat no es de Instagram" }, 400);
  }

  // 2) Token del tenant (service role — RLS oculta los tokens al navegador).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: account } = await admin
    .from("social_accounts")
    .select("access_token")
    .eq("tenant_id", chat.tenant_id)
    .eq("channel", "instagram")
    .eq("status", "active")
    .maybeSingle();
  const token = account?.access_token;
  if (!token) {
    return jsonResponse(
      { success: false, error: "El comerciante no tiene Instagram conectado" },
      409,
    );
  }

  // 2b) Modo DEMO: page/user token con prefijo "DEMO-" (catálogo de
  //     demostración, sin cuenta real) → insertar directo sin llamar a la API.
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

  // 3) Enviar por la API de Instagram.
  const message = mediaUrl
    ? { attachment: { type: "image", payload: { url: mediaUrl } } }
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
        message,
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("IG API error:", res.status, JSON.stringify(result));
      const igError = result?.error?.message ?? "No se pudo enviar el mensaje";
      // Fuera de la ventana de 24h → mensaje claro para la UI.
      const friendly = String(igError).includes("outside of allowed window") ||
          result?.error?.code === 10
        ? "Fuera de la ventana de 24h: en Instagram solo puedes responder hasta 24h después del último mensaje del cliente."
        : igError;
      return jsonResponse({ success: false, error: friendly }, 502);
    }
    messageId = result?.message_id ?? null;
  } catch (err) {
    console.error("ig-send fetch error:", err);
    return jsonResponse({ success: false, error: String(err) }, 500);
  }

  // 4) Persistir + actualizar preview (mismo contrato que wa-send).
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
