import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// wa-webhook — WhatsApp Cloud API inbound webhook
//
// Meta sends:
//   • GET  with hub.mode/hub.verify_token/hub.challenge → must echo challenge.
//   • POST with message payloads → we map them into chats/chat_messages.
//
// This is the REAL inbound path for when Meta approves the app. Until then the
// public `post_demo_customer_message` RPC (see migration) stands in for it so
// the inbox can be tested with the customer simulator. Deploy with
// verify_jwt=false (Meta can't send a Supabase JWT).
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("WA_WEBHOOK_VERIFY_TOKEN") ?? "catalogohoy-wa";
const APP_SECRET = Deno.env.get("WA_APP_SECRET");
const API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const MEDIA_TYPES = ["image", "video", "audio", "document", "sticker"];

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function digits(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Verify Meta's X-Hub-Signature-256 (HMAC SHA256 del raw body con el app secret).
 *  Si no hay APP_SECRET configurado todavía, se omite (dev). */
async function isValidSignature(raw: string, header: string | null): Promise<boolean> {
  if (!APP_SECRET) return true; // aún sin secret (dev) → no bloquear
  if (!header?.startsWith("sha256=")) return false;
  const expected = header.slice("sha256=".length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === expected;
}

/** Texto a mostrar en el inbox para mensajes que no son de texto plano. */
function describeMessage(m: Record<string, unknown>): string {
  if ((m.text as { body?: string })?.body) return (m.text as { body: string }).body;
  switch (m.type) {
    case "image": return "📷 Imagen";
    case "video": return "🎥 Video";
    case "audio": return "🎤 Audio";
    case "document": return "📎 Documento";
    case "sticker": return "Sticker";
    case "location": return "📍 Ubicación";
    case "contacts": return "👤 Contacto";
    default: break;
  }
  const btn = (m.button as { text?: string })?.text;
  if (btn) return btn;
  const interactive = m.interactive as {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  } | undefined;
  return (
    interactive?.button_reply?.title ??
    interactive?.list_reply?.title ??
    ""
  );
}

/** Resolve the tenant + access token for the WhatsApp phone_number_id hit. The
 *  token is needed to download inbound media from Meta. */
async function accountForPhoneNumberId(
  phoneNumberId: string,
): Promise<{ tenantId: number; token: string | null } | null> {
  const { data } = await admin
    .from("whatsapp_accounts")
    .select("tenant_id, access_token")
    .eq("phone_number_id", phoneNumberId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return { tenantId: data.tenant_id, token: data.access_token ?? null };
}

/** Download an inbound media file from Meta (needs the tenant token) and re-host
 *  it in the public `catalogohoy` bucket. Returns the public URL or null. */
async function downloadAndStore(
  mediaId: string,
  token: string,
  tenantId: number,
  mime: string,
): Promise<string | null> {
  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();
    if (!meta?.url) return null;

    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!fileRes.ok) return null;
    const bytes = new Uint8Array(await fileRes.arrayBuffer());

    const ext = ((mime || meta.mime_type || "application/octet-stream").split("/")[1] ?? "bin")
      .split(";")[0];
    const path = `chat-media/${tenantId}/in-${Date.now()}-${
      Math.random().toString(36).slice(2)
    }.${ext}`;
    const { error } = await admin.storage
      .from("catalogohoy")
      .upload(path, bytes, { contentType: mime || meta.mime_type, upsert: true });
    if (error) {
      console.error("[wa-webhook] storage upload error", error.message);
      return null;
    }
    return admin.storage.from("catalogohoy").getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.error("[wa-webhook] downloadAndStore error", err);
    return null;
  }
}

/** Find-or-create the conversation for (tenant, customer phone). Returns whether
 *  the matched chat already had a name (so we don't clobber a registered alias). */
async function findOrCreateChat(
  tenantId: number,
  phone: string,
  name: string | null,
): Promise<{ id: number; hasName: boolean } | null> {
  const { data: existing } = await admin
    .from("chats")
    .select("id, customer_phone, customer_name")
    .eq("tenant_id", tenantId);

  const match = (existing ?? []).find(
    (c: { customer_phone: string | null }) =>
      digits(c.customer_phone ?? "") === digits(phone),
  );
  if (match) {
    return {
      id: match.id,
      hasName: !!String(match.customer_name ?? "").trim(),
    };
  }

  const { data: created } = await admin
    .from("chats")
    .insert({ tenant_id: tenantId, customer_phone: phone, customer_name: name })
    .select("id")
    .single();
  return created ? { id: created.id, hasName: !!name } : null;
}

async function handleIncoming(body: unknown): Promise<void> {
  // Meta payload: entry[].changes[].value.{ metadata.phone_number_id, contacts[], messages[] }
  const entries = (body as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value;
      if (!value) continue;

      const phoneNumberId = (value.metadata as { phone_number_id?: string })
        ?.phone_number_id;
      const messages = (value.messages as unknown[]) ?? [];
      if (!phoneNumberId || messages.length === 0) continue;

      const account = await accountForPhoneNumberId(phoneNumberId);
      if (!account) continue;
      const tenantId = account.tenantId;

      const contacts = (value.contacts as { profile?: { name?: string } }[]) ?? [];
      const profileName = contacts[0]?.profile?.name ?? null;

      for (const m of messages as Record<string, unknown>[]) {
        const from = (m.from as string) ?? "";
        if (!from) continue;

        let text = describeMessage(m);
        let messageType = "text";
        let mediaUrl: string | null = null;

        // Media entrante: la descargamos de Meta (con el token del comerciante) y
        // la re-hosteamos en el bucket para poder mostrarla en la burbuja.
        const mtype = m.type as string;
        if (MEDIA_TYPES.includes(mtype) && account.token) {
          const media = m[mtype] as
            | { id?: string; mime_type?: string; caption?: string }
            | undefined;
          if (media?.id) {
            const url = await downloadAndStore(
              media.id,
              account.token,
              tenantId,
              media.mime_type ?? "",
            );
            if (url) {
              mediaUrl = url;
              messageType = mtype === "sticker" ? "image" : mtype;
              text = (media.caption ?? "").trim() || describeMessage(m);
            }
          }
        }
        if (!text && !mediaUrl) continue;

        const chat = await findOrCreateChat(tenantId, from, profileName);
        if (!chat) continue;
        const chatId = chat.id;

        // Respuesta citada: el cliente respondió a un mensaje → mapeamos el wamid
        // citado (m.context.id) al mensaje local correspondiente.
        const waMessageId = (m.id as string) ?? null;
        const ctxId = (m.context as { id?: string } | undefined)?.id;
        let replyToMessageId: number | null = null;
        if (ctxId) {
          const { data: quoted } = await admin
            .from("chat_messages")
            .select("id")
            .eq("wa_message_id", ctxId)
            .maybeSingle();
          replyToMessageId = quoted?.id ?? null;
        }

        await admin.from("chat_messages").insert({
          chat_id: chatId,
          content: text,
          is_mine: false,
          message_type: messageType,
          media_url: mediaUrl,
          wa_message_id: waMessageId,
          reply_to_message_id: replyToMessageId,
        });

        const chatUpdate: Record<string, unknown> = {
          last_message: text,
          last_message_at: new Date().toISOString(),
        };
        // Sólo usar el nombre de perfil de WhatsApp si el contacto NO tiene un
        // nombre registrado (respeta el alias del módulo de clientes / órdenes).
        if (profileName && !chat.hasName) chatUpdate.customer_name = profileName;
        await admin.from("chats").update(chatUpdate).eq("id", chatId);
        // unread_count increment is handled by a trigger in prod; kept simple here.
      }
    }
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // 1) Verification handshake (GET).
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2) Incoming messages (POST). Always 200 quickly so Meta doesn't retry.
  if (req.method === "POST") {
    const raw = await req.text();
    const valid = await isValidSignature(raw, req.headers.get("x-hub-signature-256"));
    if (!valid) {
      console.error("[wa-webhook] invalid signature");
      return new Response("Forbidden", { status: 403 });
    }
    try {
      await handleIncoming(JSON.parse(raw));
    } catch (err) {
      console.error("[wa-webhook] error", err);
    }
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
});
