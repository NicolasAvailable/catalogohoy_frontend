import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// fb-webhook — webhook de Messenger (Páginas de Facebook) del CRM omnicanal.
// Espejo de ig-webhook pero con `object: 'page'` y la Graph API de Facebook:
// entry[].messaging[] con sender/recipient por PSID (page-scoped id).
//
// Eventos soportados (campo `messages` de la suscripción de la Página):
//   • message  → mensaje del cliente (is_mine=false) o echo de lo que el
//                comerciante responde desde la app/Inbox de FB
//                (message.is_echo=true → is_mine=true)
//   • read     → acuse de lectura → delivery_status='read'
//
// Ruteo: entry.id = PAGE_ID de la Página del comerciante → social_accounts
// (channel='messenger') → tenant. Los chats van a la MISMA bandeja que WhatsApp
// con channel='messenger' + external_user_id = PSID del cliente.
//
// Deploy con verify_jwt=false (Meta no manda JWT); firma X-Hub-Signature-256
// con FB_APP_SECRET.
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("FB_WEBHOOK_VERIFY_TOKEN") ?? "catalogohoy-fb";
// Messenger puede vivir en la app principal (misma que WhatsApp) o en una app
// dedicada → se aceptan ambas firmas.
const SECRETS = [
  Deno.env.get("FB_APP_SECRET")?.trim(),
  Deno.env.get("WA_APP_SECRET")?.trim(),
].filter((s): s is string => !!s);
const GRAPH = "https://graph.facebook.com/v23.0";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function hmacHex(secret: string, raw: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isValidSignature(raw: string, header: string | null): Promise<boolean> {
  if (SECRETS.length === 0) return true; // sin secrets (dev) → no bloquear
  if (!header?.startsWith("sha256=")) return false;
  const expected = header.slice("sha256=".length);
  for (const secret of SECRETS) {
    if ((await hmacHex(secret, raw)) === expected) return true;
  }
  // MODO PERMISIVO (dev, pre-lanzamiento): la firma no cuadra → registrar el
  // prefijo para diagnosticar pero ACEPTAR. Endurecer (return false) antes del
  // flip de lanzamiento.
  console.error("[fb-webhook] firma no coincide", {
    expectedPrefix: expected.slice(0, 10),
    candidates: await Promise.all(
      SECRETS.map(async (s) => (await hmacHex(s, raw)).slice(0, 10)),
    ),
  });
  return true;
}

type FbAccount = { tenantId: number; token: string | null };

/** Página conectada (por PAGE_ID) → tenant + page access token. */
async function accountForPageId(pageId: string): Promise<FbAccount | null> {
  const { data } = await admin
    .from("social_accounts")
    .select("tenant_id, access_token")
    .eq("channel", "messenger")
    .eq("external_account_id", pageId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return { tenantId: data.tenant_id, token: data.access_token ?? null };
}

/** Find-or-create del chat de Messenger: match por (tenant, channel, PSID). */
async function findOrCreateFbChat(
  tenantId: number,
  psid: string,
  token: string | null,
): Promise<{ id: number; hasName: boolean } | null> {
  const { data: existing } = await admin
    .from("chats")
    .select("id, customer_name")
    .eq("tenant_id", tenantId)
    .eq("channel", "messenger")
    .eq("external_user_id", psid)
    .maybeSingle();
  if (existing) {
    return {
      id: existing.id,
      hasName: !!String(existing.customer_name ?? "").trim(),
    };
  }

  // Perfil del cliente (nombre) — best-effort con el page token.
  let name: string | null = null;
  if (token) {
    try {
      const res = await fetch(
        `${GRAPH}/${psid}?fields=name,first_name,last_name&access_token=${token}`,
      );
      if (res.ok) {
        const p = await res.json();
        name = (p?.name ??
          [p?.first_name, p?.last_name].filter(Boolean).join(" ")).trim() || null;
      }
    } catch {
      /* best-effort */
    }
  }

  const { data: created } = await admin
    .from("chats")
    .insert({
      tenant_id: tenantId,
      channel: "messenger",
      external_user_id: psid,
      customer_name: name ?? "Messenger",
    })
    .select("id")
    .single();
  return created ? { id: created.id, hasName: !!name } : null;
}

async function messageExists(mid: string): Promise<boolean> {
  const { data } = await admin
    .from("chat_messages")
    .select("id")
    .eq("wa_message_id", mid)
    .limit(1);
  return (data ?? []).length > 0;
}

/** Descarga media del CDN de FB (URL temporal) y la re-hospeda en Storage. */
async function downloadAndStore(
  url: string,
  tenantId: number,
): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const mime = res.headers.get("content-type") ?? "application/octet-stream";
    const ext = (mime.split("/")[1] ?? "bin").split(";")[0];
    const path = `chat-media/${tenantId}/fb-${Date.now()}-${
      Math.random().toString(36).slice(2)
    }.${ext}`;
    const { error } = await admin.storage
      .from("catalogohoy")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (error) return null;
    return admin.storage.from("catalogohoy").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

/** Tipo de attachment de Messenger → message_type + placeholder del inbox. */
function describeAttachment(type: string): { messageType: string; label: string } {
  switch (type) {
    case "image": return { messageType: "image", label: "📷 Imagen" };
    case "video": return { messageType: "video", label: "🎥 Video" };
    case "audio": return { messageType: "audio", label: "🎤 Audio" };
    case "file": return { messageType: "document", label: "📎 Documento" };
    case "location": return { messageType: "text", label: "📍 Ubicación" };
    case "fallback": return { messageType: "text", label: "🔗 Adjunto" };
    default: return { messageType: "text", label: "" };
  }
}

type Messaging = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: { type?: string; payload?: { url?: string } }[];
  };
  read?: { watermark?: number };
};

async function processMessaging(
  pageId: string,
  account: FbAccount,
  m: Messaging,
): Promise<void> {
  // ── Acuse de lectura: el cliente leyó → ✓✓ azul en todo lo enviado. ──
  if (m.read) {
    const customerPsid = m.sender?.id ?? "";
    if (!customerPsid) return;
    const { data: chat } = await admin
      .from("chats")
      .select("id")
      .eq("tenant_id", account.tenantId)
      .eq("channel", "messenger")
      .eq("external_user_id", customerPsid)
      .maybeSingle();
    if (!chat) return;
    await admin
      .from("chat_messages")
      .update({ delivery_status: "read" })
      .eq("chat_id", chat.id)
      .eq("is_mine", true)
      .not("wa_message_id", "is", null)
      .neq("delivery_status", "read");
    return;
  }

  const msg = m.message;
  if (!msg) return;

  const isEcho = msg.is_echo === true;
  // Inbound: sender = cliente. Echo: recipient = cliente.
  const customerPsid = (isEcho ? m.recipient?.id : m.sender?.id) ?? "";
  if (!customerPsid || customerPsid === pageId) return;

  const mid = msg.mid ?? null;
  if (mid && (await messageExists(mid))) return; // dedupe (echo de fb-send)

  let text = (msg.text ?? "").trim();
  let messageType = "text";
  let mediaUrl: string | null = null;

  const att = (msg.attachments ?? [])[0];
  if (att) {
    const { messageType: mt, label } = describeAttachment(att.type ?? "");
    const url = att.payload?.url ?? "";
    if (url) {
      mediaUrl = await downloadAndStore(url, account.tenantId);
      if (mediaUrl) messageType = mt;
    }
    if (!text) text = label || "📎 Adjunto";
  }
  if (!text && !mediaUrl) return;

  const chat = await findOrCreateFbChat(
    account.tenantId,
    customerPsid,
    account.token,
  );
  if (!chat) return;

  const ts = m.timestamp ? new Date(m.timestamp).toISOString() : null;

  await admin.from("chat_messages").insert({
    chat_id: chat.id,
    content: text,
    is_mine: isEcho,
    message_type: messageType,
    media_url: mediaUrl,
    wa_message_id: mid,
    ...(isEcho ? { delivery_status: "sent" } : {}),
    ...(ts ? { created_at: ts } : {}),
  });

  await admin
    .from("chats")
    .update({
      last_message: text,
      last_message_at: ts ?? new Date().toISOString(),
      last_message_is_mine: isEcho,
    })
    .eq("id", chat.id);
}

// ── Comentarios de posts (field 'feed' del webhook de la Página) ────────────
type FbFeedValue = {
  item?: string;      // 'comment' | 'post' | 'reaction' | ...
  verb?: string;      // 'add' | 'edited' | 'remove' | 'hide'
  comment_id?: string;
  post_id?: string;
  parent_id?: string;
  message?: string;
  from?: { id?: string; name?: string };
  created_time?: number;
  post?: { permalink_url?: string };
};

/** Detalles del post para anclarlo como "mensaje" — best-effort. */
async function fetchFbPostInfo(
  postId: string,
  token: string | null,
): Promise<{ caption: string | null; thumbnail: string | null; permalink: string | null }> {
  if (!postId || !token) return { caption: null, thumbnail: null, permalink: null };
  try {
    const res = await fetch(
      `${GRAPH}/${postId}?fields=message,full_picture,permalink_url&access_token=${token}`,
    );
    if (!res.ok) return { caption: null, thumbnail: null, permalink: null };
    const p = await res.json();
    return {
      caption: (p?.message ?? "").trim() || null,
      thumbnail: p?.full_picture ?? null,
      permalink: p?.permalink_url ?? null,
    };
  } catch {
    return { caption: null, thumbnail: null, permalink: null };
  }
}

async function processFbComment(
  pageId: string,
  account: FbAccount,
  value: FbFeedValue,
): Promise<void> {
  if (value.item !== "comment") return;
  if (value.verb && !["add", "edited"].includes(value.verb)) return;
  const commentId = value.comment_id ?? "";
  if (!commentId) return;
  const fromId = value.from?.id ?? "";
  const isMine = !!fromId && fromId === pageId; // respuesta de la Página
  const parent = value.parent_id && value.parent_id !== value.post_id
    ? value.parent_id
    : null;
  const post = await fetchFbPostInfo(value.post_id ?? "", account.token);
  await admin.from("social_comments").upsert(
    {
      tenant_id: account.tenantId,
      channel: "facebook",
      external_comment_id: commentId,
      parent_comment_id: parent,
      post_id: value.post_id ?? null,
      post_permalink: post.permalink ?? value.post?.permalink_url ?? null,
      post_caption: post.caption,
      post_thumbnail_url: post.thumbnail,
      author_id: fromId || null,
      author_name: value.from?.name ?? null,
      text: (value.message ?? "").trim() || null,
      is_mine: isMine,
      status: isMine ? "replied" : "open",
      ...(value.created_time
        ? { created_at: new Date(value.created_time * 1000).toISOString() }
        : {}),
    },
    { onConflict: "channel,external_comment_id", ignoreDuplicates: true },
  );
}

async function handleIncoming(body: unknown): Promise<void> {
  const b = body as { object?: string; entry?: unknown[] };
  // Solo eventos de Página (Messenger + feed). Los de Instagram los toma ig-webhook.
  if (b?.object && b.object !== "page") return;
  const entries = b?.entry ?? [];
  for (const entry of entries) {
    const pageId = String((entry as { id?: string })?.id ?? "");
    if (!pageId) continue;

    const account = await accountForPageId(pageId);
    if (!account) continue;

    // DMs (entry.messaging[]).
    const messaging = ((entry as { messaging?: Messaging[] })?.messaging ?? []);
    for (const m of messaging) {
      try {
        await processMessaging(pageId, account, m);
      } catch (err) {
        console.error("[fb-webhook] processMessaging error", err);
      }
    }

    // Comentarios (entry.changes[] con field 'feed', item 'comment').
    const changes = ((entry as { changes?: { field?: string; value?: FbFeedValue }[] })?.changes ?? []);
    for (const ch of changes) {
      if (ch?.field !== "feed" || !ch.value) continue;
      try {
        await processFbComment(pageId, account, ch.value);
      } catch (err) {
        console.error("[fb-webhook] processFbComment error", err);
      }
    }
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1) Handshake de verificación (GET).
  if (req.method === "GET") {
    if (url.searchParams.get("debug") === "secrets") {
      return new Response(
        JSON.stringify({
          fb: !!Deno.env.get("FB_APP_SECRET"),
          wa: !!Deno.env.get("WA_APP_SECRET"),
          verifyToken: !!Deno.env.get("FB_WEBHOOK_VERIFY_TOKEN"),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2) Eventos (POST): siempre 200 rápido para que Meta no reintente.
  if (req.method === "POST") {
    const raw = await req.text();
    const valid = await isValidSignature(raw, req.headers.get("x-hub-signature-256"));
    if (!valid) {
      console.error("[fb-webhook] invalid signature");
      return new Response("Forbidden", { status: 403 });
    }
    try {
      await handleIncoming(JSON.parse(raw));
    } catch (err) {
      console.error("[fb-webhook] error", err);
    }
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
});
