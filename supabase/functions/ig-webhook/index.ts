import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// =============================================================================
// ig-webhook — webhook de la API de Instagram (DMs del CRM omnicanal).
//
// v1 = STUB: responde el handshake de verificación de Meta (GET) y loguea los
// POST entrantes para inspección durante el desarrollo. CAT-41 lo completa
// (messages / message_echoes / message_reads → chats/chat_messages con
// channel='instagram', ruteo por IGSID vía social_accounts).
//
// Deploy con verify_jwt=false (Meta no manda JWT de Supabase).
// =============================================================================

const VERIFY_TOKEN = Deno.env.get("IG_WEBHOOK_VERIFY_TOKEN") ?? "catalogohoy-ig";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1) Handshake de verificación (GET).
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2) Eventos (POST): por ahora solo log — siempre 200 para que Meta no reintente.
  if (req.method === "POST") {
    try {
      console.log("[ig-webhook] payload:", await req.text());
    } catch {
      /* noop */
    }
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
});
