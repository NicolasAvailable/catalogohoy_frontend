import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// social-comment-reply — responde públicamente un comentario de IG o FB desde
// el CRM omnicanal.
//
// Input (POST, JWT del agente): { commentId: number, text: string }
//   commentId = id de la fila en social_comments (NO el id de Meta).
//
// Autorización por RLS: leemos la fila con el JWT del que llama; si la ve, es
// miembro del tenant → puede responder.
//
// Reply:
//   • Instagram: POST {graph.instagram}/v23.0/{comment-id}/replies
//   • Facebook:  POST {graph.facebook}/v23.0/{comment-id}/comments
// El token sale de social_accounts (IG: channel='instagram'; FB: channel=
// 'messenger', page access token).
//
// Deploy con verify_jwt=true.
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const GRAPH: Record<string, string> = {
  instagram: "https://graph.instagram.com/v23.0",
  facebook: "https://graph.facebook.com/v23.0",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  let payload: { commentId?: number; text?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const commentId = Number(payload.commentId);
  const text = (payload.text ?? "").trim();
  if (!commentId || !text) return json({ error: "Faltan commentId/text" }, 400);
  if (text.length > 2000) return json({ error: "El texto es muy largo" }, 400);

  // 1) Autorización por RLS: la fila debe ser visible con el JWT del que llama.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: comment } = await userClient
    .from("social_comments")
    .select("id, tenant_id, channel, external_comment_id, post_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return json({ error: "Comentario no encontrado" }, 404);

  const channel = String(comment.channel);
  const graph = GRAPH[channel];
  if (!graph) return json({ error: "Canal no soportado" }, 400);

  // 2) Token de la cuenta conectada (IG → instagram; FB → messenger/page token).
  const accountChannel = channel === "instagram" ? "instagram" : "messenger";
  const { data: account } = await admin
    .from("social_accounts")
    .select("access_token")
    .eq("tenant_id", comment.tenant_id)
    .eq("channel", accountChannel)
    .eq("status", "active")
    .maybeSingle();
  if (!account?.access_token) {
    return json({ error: "La cuenta no está conectada" }, 409);
  }

  // 3) Publicar la respuesta en el post.
  //    IG usa /replies; FB usa /comments (mismo efecto: respuesta anidada).
  const path = channel === "instagram" ? "replies" : "comments";
  const form = new URLSearchParams({
    message: text,
    access_token: account.access_token,
  });
  const res = await fetch(`${graph}/${comment.external_comment_id}/${path}`, {
    method: "POST",
    body: form,
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok || !result?.id) {
    console.error("[social-comment-reply] Meta error", JSON.stringify(result));
    return json(
      { error: result?.error?.message ?? "No se pudo publicar la respuesta" },
      502,
    );
  }

  // 4) Persistir nuestra respuesta + marcar el comentario original como respondido.
  await admin.from("social_comments").upsert(
    {
      tenant_id: comment.tenant_id,
      channel,
      external_comment_id: String(result.id),
      parent_comment_id: comment.external_comment_id,
      post_id: comment.post_id,
      text,
      is_mine: true,
      status: "replied",
    },
    { onConflict: "channel,external_comment_id", ignoreDuplicates: true },
  );
  await admin
    .from("social_comments")
    .update({ status: "replied" })
    .eq("id", comment.id);

  return json({ success: true, replyId: String(result.id) });
});
