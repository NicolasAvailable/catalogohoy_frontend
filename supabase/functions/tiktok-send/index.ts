import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// tiktok-send — respuesta del agente por TikTok (CRM → cliente), espejo de
// ig-send. El envío REAL vía TikTok Business Messaging API sigue gateado por
// TikTok (acceso en revisión), así que hoy la función soporta:
//   • Modo DEMO: token con prefijo "DEMO-" → inserta directo (catálogo demo).
//   • Real: devuelve un error claro hasta que TikTok habilite el acceso.
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

type Payload = { chatId: number; text?: string; mediaUrl?: string };

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
    return jsonResponse({ success: false, error: "chat lookup failed" }, 500);
  }
  if (!chat) {
    return jsonResponse({ success: false, error: "Chat not found or forbidden" }, 403);
  }
  if (chat.channel !== "tiktok" || !chat.external_user_id) {
    return jsonResponse({ success: false, error: "El chat no es de TikTok" }, 400);
  }

  // 2) Token del tenant (service role — RLS oculta los tokens).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: account } = await admin
    .from("social_accounts")
    .select("access_token")
    .eq("tenant_id", chat.tenant_id)
    .eq("channel", "tiktok")
    .eq("status", "active")
    .maybeSingle();
  const token = account?.access_token;
  if (!token) {
    return jsonResponse(
      { success: false, error: "El comerciante no tiene TikTok conectado" },
      409,
    );
  }

  // 2b) Modo DEMO: token con prefijo "DEMO-" → insertar directo.
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

  // 3) Envío real: TikTok Business Messaging aún en revisión de acceso.
  return jsonResponse(
    {
      success: false,
      error:
        "El envío por TikTok se habilitará cuando TikTok apruebe el acceso a la Business Messaging API.",
    },
    503,
  );
});
