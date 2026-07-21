import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Transcribe una nota de voz del chat (chat_messages.type = 'audio') con
// Whisper vía fal.ai y persiste el texto en chat_messages.transcript.
//
// Flujo:
//   1. Autorización: el agente lee el mensaje con SU JWT → RLS solo lo deja
//      ver mensajes de chats de su tenant (mismo patrón que wa-send).
//   2. Idempotencia: si el mensaje ya tiene transcript, se devuelve sin
//      cobrar créditos.
//   3. Créditos IA: 1 crédito por transcripción, mismas RPCs atómicas que
//      fal-ai-images (ensure/spend/refund sobre el pozo del owner).
//   4. Whisper (fal-ai/whisper) sobre la URL pública del audio en Storage.

const FAL_KEY = Deno.env.get("FAL_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WHISPER_MODEL = "fal-ai/whisper";
const COST = 1;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!FAL_KEY) {
    return jsonResponse({ success: false, error: "IA no configurada" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  let body: { messageId?: number };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }
  const messageId = Number(body.messageId);
  if (!messageId) {
    return jsonResponse({ success: false, error: "Missing messageId" }, 400);
  }

  // 1) Autorización vía RLS: si el JWT no pertenece a un miembro del tenant
  //    dueño del chat, el select no devuelve fila.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const { data: msg, error: msgErr } = await userClient
    .from("chat_messages")
    .select("id, message_type, media_url, transcript")
    .eq("id", messageId)
    .maybeSingle();
  if (msgErr) {
    console.error("message lookup error:", msgErr.message);
    return jsonResponse({ success: false, error: "message lookup failed" }, 500);
  }
  if (!msg) {
    return jsonResponse(
      { success: false, error: "Mensaje no encontrado" },
      403,
    );
  }
  if (msg.message_type !== "audio" || !msg.media_url) {
    return jsonResponse(
      { success: false, error: "El mensaje no es una nota de voz" },
      400,
    );
  }

  // 2) Idempotencia: ya transcrito → gratis.
  if ((msg.transcript ?? "").trim()) {
    return jsonResponse({ success: true, transcript: msg.transcript });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 3) Gate de créditos (owner = users.id del JWT, nunca del body).
  const { data: ownerRow } = await admin
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const ownerId = (ownerRow as { id?: number } | null)?.id;
  if (!ownerId) {
    return jsonResponse({ success: false, error: "Usuario no encontrado" }, 403);
  }

  await admin.rpc("ensure_ai_credits", { p_user_id: ownerId });
  const { data: balance, error: spendErr } = await admin.rpc(
    "spend_ai_credits",
    { p_user_id: ownerId, p_cost: COST },
  );
  if (spendErr) {
    console.error("spend_ai_credits error:", spendErr);
    return jsonResponse(
      { success: false, error: "No se pudo verificar tus créditos." },
      500,
    );
  }
  if (balance === -1) {
    return jsonResponse(
      {
        success: false,
        error: "No te quedan créditos de IA. Compra más o sube de plan.",
        code: "no_credits",
      },
      402,
    );
  }

  // 4) Whisper. El audio de WhatsApp es .ogg/opus, soportado por el modelo.
  try {
    const res = await fetch(`https://fal.run/${WHISPER_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio_url: msg.media_url, task: "transcribe" }),
    });
    if (!res.ok) {
      throw new Error(`fal.ai ${res.status}: ${await res.text()}`);
    }
    const out = (await res.json()) as { text?: string };
    const transcript = (out.text ?? "").trim();
    if (!transcript) {
      throw new Error("Whisper no devolvió texto");
    }

    await admin
      .from("chat_messages")
      .update({ transcript })
      .eq("id", messageId);

    // Registro para el panel interno de uso de IA (best-effort).
    try {
      await admin.from("ai_usage_log").insert({
        user_id: ownerId,
        feature: "chat-transcribe",
        prompt: null,
        credits: COST,
      });
    } catch (e) {
      console.error("ai_usage_log insert failed:", e);
    }

    return jsonResponse({ success: true, transcript });
  } catch (err) {
    console.error("[wa-transcribe]", err);
    await admin.rpc("refund_ai_credits", { p_user_id: ownerId, p_cost: COST });
    return jsonResponse(
      { success: false, error: "No se pudo transcribir el audio. Intenta de nuevo." },
      500,
    );
  }
});
