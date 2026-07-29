import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// ig-webhook — webhook de la API de Instagram (Instagram Login) del CRM
// omnicanal. Mismo modelo que wa-webhook pero con el formato Messenger-style
// de IG: entry[].messaging[] con sender/recipient por IGSID.
//
// Eventos soportados (field `messages` de la app CatalogoHoy-IG):
//   • message                → DM del cliente (is_mine=false) o echo de lo que
//                              el comerciante responde desde la app de IG
//                              (message.is_echo=true → is_mine=true)
//   • read                   → acuse de lectura → delivery_status='read'
//   • reaction               → ignorado en v1
//
// Ruteo: entry.id = IGSID de la cuenta del comerciante → social_accounts
// (channel='instagram') → tenant. Los chats van a la MISMA bandeja que
// WhatsApp con channel='instagram' + external_user_id = IGSID del cliente.
//
// Deploy con verify_jwt=false (Meta no manda JWT); firma X-Hub-Signature-256
// con IG_APP_SECRET.
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("IG_WEBHOOK_VERIFY_TOKEN") ?? "catalogohoy-ig";
// El caso de uso de Instagram vive DENTRO de la app CatalogoHoy: según el
// origen del evento, Meta puede firmar con el secret de la app de Instagram
// (IG_APP_SECRET) o con el de la app principal (WA_APP_SECRET) → se aceptan
// ambas firmas.
const SECRETS = [
  Deno.env.get("IG_APP_SECRET")?.trim(),
  Deno.env.get("WA_APP_SECRET")?.trim(),
].filter((s): s is string => !!s);
const GRAPH = "https://graph.instagram.com/v23.0";

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
  // MODO PERMISIVO (dev, pre-lanzamiento): la firma no cuadra con ninguno de
  // los secrets configurados → registrar el prefijo para diagnosticar pero
  // ACEPTAR el evento. Endurecer (return false) antes del flip de lanzamiento.
  console.error("[ig-webhook] firma no coincide", {
    expectedPrefix: expected.slice(0, 10),
    candidates: await Promise.all(
      SECRETS.map(async (s) => (await hmacHex(s, raw)).slice(0, 10)),
    ),
  });
  return true;
}

type IgAccount = { tenantId: number; token: string | null };

/** Cuenta de Instagram conectada (por IGSID del comerciante) → tenant + token. */
async function accountForIgId(igId: string): Promise<IgAccount | null> {
  const { data } = await admin
    .from("social_accounts")
    .select("tenant_id, access_token")
    .eq("channel", "instagram")
    .eq("external_account_id", igId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return { tenantId: data.tenant_id, token: data.access_token ?? null };
}

/** Find-or-create del chat de Instagram: match por (tenant, channel, IGSID). */
async function findOrCreateIgChat(
  tenantId: number,
  igsid: string,
  token: string | null,
): Promise<{ id: number; hasName: boolean } | null> {
  const { data: existing } = await admin
    .from("chats")
    .select("id, customer_name")
    .eq("tenant_id", tenantId)
    .eq("channel", "instagram")
    .eq("external_user_id", igsid)
    .maybeSingle();
  if (existing) {
    return {
      id: existing.id,
      hasName: !!String(existing.customer_name ?? "").trim(),
    };
  }

  // Perfil del cliente (nombre + username) — best-effort con el token del tenant.
  let name: string | null = null;
  let username: string | null = null;
  if (token) {
    try {
      const res = await fetch(
        `${GRAPH}/${igsid}?fields=name,username&access_token=${token}`,
      );
      if (res.ok) {
        const p = await res.json();
        name = (p?.name ?? "").trim() || null;
        username = (p?.username ?? "").trim() || null;
      }
    } catch {
      /* best-effort */
    }
  }

  const { data: created } = await admin
    .from("chats")
    .insert({
      tenant_id: tenantId,
      channel: "instagram",
      external_user_id: igsid,
      customer_username: username,
      customer_name: name ?? (username ? `@${username}` : "Instagram"),
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

/** Descarga media del CDN de IG (URL temporal) y la re-hospeda en Storage. */
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
    const path = `chat-media/${tenantId}/ig-${Date.now()}-${
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

/** Tipo de attachment de IG → message_type + placeholder del inbox. */
function describeAttachment(type: string): { messageType: string; label: string } {
  switch (type) {
    case "image": return { messageType: "image", label: "📷 Imagen" };
    case "video": return { messageType: "video", label: "🎥 Video" };
    case "audio": return { messageType: "audio", label: "🎤 Audio" };
    case "file": return { messageType: "document", label: "📎 Documento" };
    case "story_mention": return { messageType: "image", label: "📖 Mención en historia" };
    case "share": return { messageType: "image", label: "🔗 Publicación compartida" };
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
  read?: { mid?: string };
};

async function processMessaging(
  businessIgId: string,
  account: IgAccount,
  m: Messaging,
): Promise<void> {
  // ── Acuse de lectura: el cliente leyó → ✓✓ azul en todo lo enviado. ──
  if (m.read) {
    const customerIgsid = m.sender?.id ?? "";
    if (!customerIgsid) return;
    const { data: chat } = await admin
      .from("chats")
      .select("id")
      .eq("tenant_id", account.tenantId)
      .eq("channel", "instagram")
      .eq("external_user_id", customerIgsid)
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
  const customerIgsid = (isEcho ? m.recipient?.id : m.sender?.id) ?? "";
  if (!customerIgsid || customerIgsid === businessIgId) return;

  const mid = msg.mid ?? null;
  if (mid && (await messageExists(mid))) return; // dedupe (echo de ig-send)

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

  const chat = await findOrCreateIgChat(
    account.tenantId,
    customerIgsid,
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

// ── Comentarios de posts (field 'comments' del webhook de IG) ───────────────
type IgCommentValue = {
  id?: string;
  text?: string;
  parent_id?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string };
};

async function processIgComment(
  businessIgId: string,
  account: IgAccount,
  value: IgCommentValue,
): Promise<void> {
  const commentId = value.id ?? "";
  if (!commentId) return;
  const fromId = value.from?.id ?? "";
  const isMine = !!fromId && fromId === businessIgId; // comentario/respuesta del negocio
  const username = value.from?.username ?? null;
  await admin.from("social_comments").upsert(
    {
      tenant_id: account.tenantId,
      channel: "instagram",
      external_comment_id: commentId,
      parent_comment_id: value.parent_id ?? null,
      post_id: value.media?.id ?? null,
      author_id: fromId || null,
      author_username: username,
      author_name: username ? `@${username}` : null,
      text: (value.text ?? "").trim() || null,
      is_mine: isMine,
      status: isMine ? "replied" : "open",
    },
    { onConflict: "channel,external_comment_id", ignoreDuplicates: true },
  );
}

async function handleIncoming(body: unknown): Promise<void> {
  const entries = (body as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const businessIgId = String((entry as { id?: string })?.id ?? "");
    if (!businessIgId) continue;

    const account = await accountForIgId(businessIgId);
    if (!account) continue;

    // DMs (Messenger-style entry.messaging[]).
    const messaging = ((entry as { messaging?: Messaging[] })?.messaging ?? []);
    for (const m of messaging) {
      try {
        await processMessaging(businessIgId, account, m);
      } catch (err) {
        console.error("[ig-webhook] processMessaging error", err);
      }
    }

    // Comentarios (entry.changes[] con field 'comments').
    const changes = ((entry as { changes?: { field?: string; value?: IgCommentValue }[] })?.changes ?? []);
    for (const ch of changes) {
      if (ch?.field !== "comments" || !ch.value) continue;
      try {
        await processIgComment(businessIgId, account, ch.value);
      } catch (err) {
        console.error("[ig-webhook] processIgComment error", err);
      }
    }
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1) Handshake de verificación (GET).
  if (req.method === "GET") {
    // Diagnóstico sin exponer valores: ¿qué secrets ve la función?
    if (url.searchParams.get("debug") === "secrets") {
      return new Response(
        JSON.stringify({
          ig: !!Deno.env.get("IG_APP_SECRET"),
          wa: !!Deno.env.get("WA_APP_SECRET"),
          verifyToken: !!Deno.env.get("IG_WEBHOOK_VERIFY_TOKEN"),
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
      console.error("[ig-webhook] invalid signature");
      return new Response("Forbidden", { status: 403 });
    }
    try {
      await handleIncoming(JSON.parse(raw));
    } catch (err) {
      console.error("[ig-webhook] error", err);
    }
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
});
