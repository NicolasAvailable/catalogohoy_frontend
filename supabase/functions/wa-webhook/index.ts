import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
// =============================================================================
// wa-webhook — WhatsApp Cloud API inbound webhook
//
// Meta sends:
//   • GET  with hub.mode/hub.verify_token/hub.challenge → must echo challenge.
//   • POST with message payloads → we map them into chats/chat_messages.
//
// Campos soportados (suscribir TODOS en la app de Meta → WhatsApp → Webhooks):
//   • messages            → mensajes del CLIENTE (is_mine=false) + statuses
//                           (acuses sent/delivered/read de lo enviado)
//   • smb_message_echoes  → COEXISTENCIA: lo que el comerciante manda desde su
//                           app de WhatsApp en el teléfono (is_mine=true)
//   • history             → COEXISTENCIA: historial sincronizado al conectar
//                           (dedupe por wamid, respeta timestamps originales)
//   • smb_app_state_sync  → COEXISTENCIA: contactos del teléfono (solo se usan
//                           para nombrar chats sin nombre)
//
// Deploy with verify_jwt=false (Meta can't send a Supabase JWT).
// =============================================================================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VERIFY_TOKEN = Deno.env.get("WA_WEBHOOK_VERIFY_TOKEN") ?? "catalogohoy-wa";
const APP_SECRET = Deno.env.get("WA_APP_SECRET");
const API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const MEDIA_TYPES = [
  "image",
  "video",
  "audio",
  "document",
  "sticker"
];
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
function digits(s) {
  return (s ?? "").replace(/\D/g, "");
}
/** Verify Meta's X-Hub-Signature-256 (HMAC SHA256 del raw body con el app secret).
 *  Si no hay APP_SECRET configurado todavía, se omite (dev). */ async function isValidSignature(raw, header) {
  if (!APP_SECRET) return true; // aún sin secret (dev) → no bloquear
  if (!header?.startsWith("sha256=")) return false;
  const expected = header.slice("sha256=".length);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(APP_SECRET), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = [
    ...new Uint8Array(sig)
  ].map((b)=>b.toString(16).padStart(2, "0")).join("");
  return hex === expected;
}
/** Texto a mostrar en el inbox para mensajes que no son de texto plano. */ function describeMessage(m) {
  if (m.text?.body) return m.text.body;
  switch(m.type){
    case "image":
      return "📷 Imagen";
    case "video":
      return "🎥 Video";
    case "audio":
      return "🎤 Audio";
    case "document":
      return "📎 Documento";
    case "sticker":
      return "Sticker";
    case "location":
      return "📍 Ubicación";
    case "contacts":
      return "👤 Contacto";
    default:
      break;
  }
  const btn = m.button?.text;
  if (btn) return btn;
  const interactive = m.interactive;
  return interactive?.button_reply?.title ?? interactive?.list_reply?.title ?? "";
}
// ── Workflow del número de AVISOS de la plataforma ──────────────────────────
// Cuando un cliente RESPONDE al número que manda las notificaciones (no está
// en whatsapp_accounts), antes se botaba el mensaje. Ahora: entra a la bandeja
// de soporte de CatalogoHoy (tenant 6) por el pipeline normal + se le manda
// UNA auto-respuesta (máx 1 cada 24h por teléfono, dedupe en
// wa_notify_autoreplies) indicando que respondemos desde el número de soporte.
const SUPPORT_TENANT_ID = 6;
const NOTIFY_AUTO_REPLY = "Este número solo envía avisos automáticos de CatalogoHoy.\n\n" +
  "Para soporte escríbenos directamente aquí:\n" +
  "https://wa.me/message/XDLRVIGXVUCSB1\n\n" +
  "Guarda ese contacto para próximas consultas 📌";

async function handleNotifyNumberInbound(value, notifyToken, notifyPnid) {
  try {
    // 1) El mensaje entra al CRM de soporte por el pipeline normal (el token
    //    del número de avisos sirve para descargar media entrante).
    await processCustomerMessages({ tenantId: SUPPORT_TENANT_ID, token: notifyToken }, value);

    const first = (value.messages ?? [])[0];
    const from = first?.from ?? "";
    if (!from) return;

    // 2) Auto-respuesta con dedupe de 24h por teléfono.
    const { data: dedupe } = await admin
      .from("wa_notify_autoreplies")
      .select("last_replied_at")
      .eq("customer_phone", from)
      .maybeSingle();
    const last = dedupe?.last_replied_at ? new Date(dedupe.last_replied_at).getTime() : 0;
    if (Date.now() - last < 24 * 3600 * 1000) return;

    if (notifyToken) {
      const res = await fetch(`https://graph.facebook.com/v23.0/${notifyPnid}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${notifyToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: { body: NOTIFY_AUTO_REPLY }
        })
      });
      if (!res.ok) {
        console.error("[wa-webhook] auto-reply avisos fallo", res.status, (await res.text()).slice(0, 300));
      }
    }
    await admin.from("wa_notify_autoreplies").upsert(
      { customer_phone: from, last_replied_at: new Date().toISOString() },
      { onConflict: "customer_phone" }
    );

    // 3) Nota interna en el chat de soporte para dar contexto al equipo.
    const chat = await findOrCreateChat(SUPPORT_TENANT_ID, from, null);
    if (chat) {
      await admin.from("chat_messages").insert({
        chat_id: chat.id,
        content: "🤖 El cliente escribió al número de AVISOS. Se le envió la auto-respuesta indicando que respondemos desde este número.",
        is_mine: true,
        is_internal: true,
        message_type: "text"
      });
    }
  } catch (e) {
    console.error("[wa-webhook] notify-inbound fallo", e instanceof Error ? e.message : String(e));
  }
}

// ── Bot de triaje del número de SOPORTE ─────────────────────────────────────
// Cuando un cliente escribe al número de soporte (tenant 6, CRM), se le manda
// el menú de opciones (botones interactivos) para clasificar la consulta:
// soporte / pagar-renovar / otra consulta. Al elegir, responde el mensaje
// canónico de la opción + deja nota interna para el agente. El menú solo se
// manda si el negocio no envió nada en las últimas 24h en ese chat: no
// interrumpe conversaciones en curso y actúa de dedupe natural (el propio
// menú es is_mine y bloquea el siguiente por 24h). Apagar: WA_SUPPORT_BOT=off.
const SUPPORT_BOT_ENABLED = (Deno.env.get("WA_SUPPORT_BOT") ?? "on") !== "off";
// phone_number_id del número de soporte +58 422-0240947 (whatsapp_accounts id 4).
const SUPPORT_BOT_PNID = Deno.env.get("WA_SUPPORT_BOT_PNID") ?? "1011157635415699";

const SUPPORT_MENU_BODY = "¡Hola! 👋 Escribiste al soporte de CatalogoHoy.\n\n" +
  "Para ayudarte más rápido, elegí una opción:";
const SUPPORT_MENU_FOOTER = "O escribí tu consulta directamente.";
// Títulos de botones: máx 20 caracteres (límite de la Cloud API).
const SUPPORT_MENU_OPTIONS = [
  {
    id: "bot_soporte",
    title: "Tengo un problema",
    reply: "Contanos tu problema con el mayor detalle posible (si podés, mandá capturas 📸) y el nombre de tu catálogo.\n\n" +
      "Un agente del equipo te responde a la brevedad 🙌"
  },
  {
    id: "bot_pagos",
    title: "Pagar o renovar",
    reply: "Para pagar o renovar tu plan tenés dos caminos:\n\n" +
      "1️⃣ Con tarjeta: entrá a tu panel de CatalogoHoy → sección *Planes* y elegí tu plan.\n" +
      "2️⃣ Por transferencia o pago móvil: escribinos acá el nombre de tu catálogo y te pasamos los datos.\n\n" +
      "Cualquier duda un agente te ayuda en unos minutos 💳"
  },
  {
    id: "bot_otro",
    title: "Otra consulta",
    reply: "¡Dale! Contanos tu consulta y en breve te responde alguien del equipo 🙌"
  }
];

/** Envía un mensaje del bot por la Cloud API con el token del número de
 *  soporte. Devuelve el wamid o null (nunca lanza). */
async function sendSupportBotPayload(token, pnid, payload) {
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${pnid}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[wa-webhook] support-bot send fallo", res.status, JSON.stringify(body)?.slice(0, 300));
      return null;
    }
    return body?.messages?.[0]?.id ?? null;
  } catch (e) {
    console.error("[wa-webhook] support-bot send error", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Registra un mensaje del bot en el chat (para que el CRM muestre lo que se
 *  envió) y actualiza el resumen del chat. */
async function recordSupportBotMessage(chatId, content, wamid) {
  await admin.from("chat_messages").insert({
    chat_id: chatId,
    content,
    is_mine: true,
    message_type: "text",
    wa_message_id: wamid
  });
  await admin.from("chats").update({
    last_message: content,
    last_message_at: new Date().toISOString(),
    last_message_is_mine: true
  }).eq("id", chatId);
}

/** Corre DESPUÉS de que processCustomerMessages ingirió el mensaje. Nunca
 *  lanza: un fallo del bot no puede afectar la ingesta del CRM. */
async function handleSupportBot(account, pnid, value) {
  try {
    if (!account.token) return;
    const first = (value.messages ?? [])[0];
    const from = first?.from ?? "";
    if (!from) return;

    const chat = await findOrCreateChat(account.tenantId, from, null);
    if (!chat) return;

    // 1) ¿Es la respuesta a un botón del menú? → contestar la opción.
    const btnId = first.interactive?.button_reply?.id ?? "";
    const option = SUPPORT_MENU_OPTIONS.find((o) => o.id === btnId);
    if (option) {
      const wamid = await sendSupportBotPayload(account.token, pnid, {
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: { body: option.reply }
      });
      if (wamid) await recordSupportBotMessage(chat.id, option.reply, wamid);
      await admin.from("chat_messages").insert({
        chat_id: chat.id,
        content: `🤖 Triaje: el cliente eligió «${option.title}».`,
        is_mine: true,
        is_internal: true,
        message_type: "text"
      });
      return;
    }

    // 2) Mensaje común → mandar el menú solo si el negocio no envió nada en
    //    las últimas 24h en este chat (conversación no activa).
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: recentMine } = await admin
      .from("chat_messages")
      .select("id")
      .eq("chat_id", chat.id)
      .eq("is_mine", true)
      .not("is_internal", "is", true)
      .gte("created_at", since)
      .limit(1);
    if ((recentMine ?? []).length > 0) return;

    const wamid = await sendSupportBotPayload(account.token, pnid, {
      messaging_product: "whatsapp",
      to: from,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: SUPPORT_MENU_BODY },
        footer: { text: SUPPORT_MENU_FOOTER },
        action: {
          buttons: SUPPORT_MENU_OPTIONS.map((o) => ({
            type: "reply",
            reply: { id: o.id, title: o.title }
          }))
        }
      }
    });
    if (wamid) {
      const preview = `${SUPPORT_MENU_BODY}\n\n` +
        SUPPORT_MENU_OPTIONS.map((o) => `▫️ ${o.title}`).join("\n");
      await recordSupportBotMessage(chat.id, preview, wamid);
    }
  } catch (e) {
    console.error("[wa-webhook] support-bot fallo", e instanceof Error ? e.message : String(e));
  }
}

/** Resolve the tenant + access token for the WhatsApp phone_number_id hit. The
 *  token is needed to download inbound media from Meta. */ async function accountForPhoneNumberId(phoneNumberId) {
  const { data } = await admin.from("whatsapp_accounts").select("tenant_id, access_token").eq("phone_number_id", phoneNumberId).eq("status", "active").maybeSingle();
  if (!data) return null;
  return {
    tenantId: data.tenant_id,
    token: data.access_token ?? null
  };
}
/** Download an inbound media file from Meta (needs the tenant token) and re-host
 *  it in the public `catalogohoy` bucket. Returns the public URL or null. */ async function downloadAndStore(mediaId, token, tenantId, mime) {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();
    if (!meta?.url) return null;
    const fileRes = await fetch(meta.url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!fileRes.ok) return null;
    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    const ext = ((mime || meta.mime_type || "application/octet-stream").split("/")[1] ?? "bin").split(";")[0];
    const path = `chat-media/${tenantId}/in-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await admin.storage.from("catalogohoy").upload(path, bytes, {
      contentType: mime || meta.mime_type,
      upsert: true
    });
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
 *  the matched chat already had a name (so we don't clobber a registered alias). */ async function findOrCreateChat(tenantId, phone, name) {
  const { data: existing } = await admin.from("chats").select("id, customer_phone, customer_name").eq("tenant_id", tenantId);
  const match = (existing ?? []).find((c)=>digits(c.customer_phone ?? "") === digits(phone));
  if (match) {
    return {
      id: match.id,
      hasName: !!String(match.customer_name ?? "").trim()
    };
  }
  const { data: created } = await admin.from("chats").insert({
    tenant_id: tenantId,
    customer_phone: phone,
    customer_name: name
  }).select("id").single();
  return created ? {
    id: created.id,
    hasName: !!name
  } : null;
}
/** ¿Ya ingresamos este wamid? Dedupe para echoes/history (Meta reintenta y el
 *  historial puede solapar con mensajes ya recibidos en vivo). */ async function messageExists(waMessageId) {
  const { data } = await admin.from("chat_messages").select("id").eq("wa_message_id", waMessageId).limit(1);
  return (data ?? []).length > 0;
}
/** Refresca last_message/last_message_at del chat con su mensaje más reciente
 *  (tras ingerir historial, que llega desordenado y con timestamps viejos). */ async function refreshChatLastMessage(chatId) {
  const { data } = await admin.from("chat_messages").select("content, created_at, is_mine").eq("chat_id", chatId).not("is_internal", "is", true).order("created_at", {
    ascending: false
  }).limit(1);
  const last = (data ?? [])[0];
  if (!last) return;
  await admin.from("chats").update({
    last_message: last.content,
    last_message_at: last.created_at,
    last_message_is_mine: last.is_mine ?? null
  }).eq("id", chatId);
}
/** COEXISTENCIA — smb_message_echoes: mensajes que el comerciante envió desde
 *  su app de WhatsApp en el teléfono. Se insertan como is_mine=true para que
 *  el CRM muestre la conversación completa. */ async function processEchoes(account, value) {
  const echoes = value.message_echoes ?? [];
  for (const m of echoes){
    const to = m.to ?? "";
    if (!to) continue;
    const waMessageId = m.id ?? null;
    if (waMessageId && await messageExists(waMessageId)) continue;
    let text = describeMessage(m);
    let messageType = "text";
    let mediaUrl = null;
    const mtype = m.type;
    if (MEDIA_TYPES.includes(mtype) && account.token) {
      const media = m[mtype];
      if (media?.id) {
        const url = await downloadAndStore(media.id, account.token, account.tenantId, media.mime_type ?? "");
        if (url) {
          mediaUrl = url;
          messageType = mtype === "sticker" ? "image" : mtype;
          text = (media.caption ?? "").trim() || describeMessage(m);
        }
      }
    }
    if (!text && !mediaUrl) continue;
    const chat = await findOrCreateChat(account.tenantId, to, null);
    if (!chat) continue;
    await admin.from("chat_messages").insert({
      chat_id: chat.id,
      content: text,
      is_mine: true,
      message_type: messageType,
      media_url: mediaUrl,
      wa_message_id: waMessageId
    });
    await admin.from("chats").update({
      last_message: text,
      last_message_at: new Date().toISOString(),
      last_message_is_mine: true
    }).eq("id", chat.id);
  }
}
/** COEXISTENCIA — history: historial de conversaciones sincronizado al conectar
 *  (si el comerciante lo autorizó). Llega en chunks con threads por cliente.
 *  Dirección: el mensaje es del cliente si `from` coincide con el wa_id del
 *  thread; si no, lo envió el negocio. Media histórica: solo placeholder (los
 *  media ids del historial suelen estar vencidos). */ async function processHistory(account, value) {
  const batches = value.history ?? [];
  for (const batch of batches){
    const threads = batch.threads ?? [];
    for (const t of threads){
      const customerWaId = t.id ?? "";
      if (!customerWaId) continue;
      const chat = await findOrCreateChat(account.tenantId, customerWaId, null);
      if (!chat) continue;
      let inserted = false;
      const msgs = t.messages ?? [];
      for (const m of msgs){
        const waMessageId = m.id ?? null;
        if (waMessageId && await messageExists(waMessageId)) continue;
        const text = describeMessage(m);
        if (!text) continue;
        const isMine = digits(m.from ?? "") !== digits(customerWaId);
        const ts = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : null;
        await admin.from("chat_messages").insert({
          chat_id: chat.id,
          content: text,
          is_mine: isMine,
          message_type: "text",
          wa_message_id: waMessageId,
          ...ts ? {
            created_at: ts
          } : {}
        });
        inserted = true;
      }
      if (inserted) await refreshChatLastMessage(chat.id);
    }
  }
}
/** COEXISTENCIA — smb_app_state_sync: contactos de la agenda del comerciante.
 *  Solo se usan para ponerle nombre a chats existentes que no lo tienen (no
 *  creamos chats por contacto: sería ruido). */ async function processStateSync(account, value) {
  const syncs = value.state_sync ?? [];
  for (const s of syncs){
    if (s.type !== "contact") continue;
    const action = s.action ?? "add";
    if (action !== "add") continue;
    const contact = s.contact;
    const phone = contact?.phone_number ?? "";
    const name = (contact?.full_name ?? contact?.first_name ?? "").trim();
    if (!phone || !name) continue;
    const { data: existing } = await admin.from("chats").select("id, customer_phone, customer_name").eq("tenant_id", account.tenantId);
    const match = (existing ?? []).find((c)=>digits(c.customer_phone ?? "") === digits(phone));
    if (match && !String(match.customer_name ?? "").trim()) {
      await admin.from("chats").update({
        customer_name: name
      }).eq("id", match.id);
    }
  }
}
/** Mensajes del CLIENTE (campo `messages`) — flujo original. */ async function processCustomerMessages(account, value) {
  const tenantId = account.tenantId;
  const messages = value.messages ?? [];
  const contacts = value.contacts ?? [];
  const profileName = contacts[0]?.profile?.name ?? null;
  for (const m of messages){
    const from = m.from ?? "";
    if (!from) continue;
    let text = describeMessage(m);
    let messageType = "text";
    let mediaUrl = null;
    // Media entrante: la descargamos de Meta (con el token del comerciante) y
    // la re-hosteamos en el bucket para poder mostrarla en la burbuja.
    const mtype = m.type;
    if (MEDIA_TYPES.includes(mtype) && account.token) {
      const media = m[mtype];
      if (media?.id) {
        const url = await downloadAndStore(media.id, account.token, tenantId, media.mime_type ?? "");
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
    const waMessageId = m.id ?? null;
    const ctxId = m.context?.id;
    let replyToMessageId = null;
    if (ctxId) {
      const { data: quoted } = await admin.from("chat_messages").select("id").eq("wa_message_id", ctxId).maybeSingle();
      replyToMessageId = quoted?.id ?? null;
    }
    await admin.from("chat_messages").insert({
      chat_id: chatId,
      content: text,
      is_mine: false,
      message_type: messageType,
      media_url: mediaUrl,
      wa_message_id: waMessageId,
      reply_to_message_id: replyToMessageId
    });
    const chatUpdate = {
      last_message: text,
      last_message_at: new Date().toISOString(),
      last_message_is_mine: false
    };
    // Sólo usar el nombre de perfil de WhatsApp si el contacto NO tiene un
    // nombre registrado (respeta el alias del módulo de clientes / órdenes).
    if (profileName && !chat.hasName) chatUpdate.customer_name = profileName;
    await admin.from("chats").update(chatUpdate).eq("id", chatId);
  // unread_count increment is handled by a trigger in prod; kept simple here.
  }
}
/** Acuses de entrega de mensajes ENVIADOS (value.statuses, llega junto al
 *  field `messages`): sent → delivered → read. Solo se sube de nivel (los
 *  eventos pueden llegar desordenados y un `read` nunca vuelve a `delivered`).
 *  `failed` (rank 4) SIEMPRE gana: Meta lo manda de forma asíncrona cuando el
 *  envío se aceptó (200) pero no se pudo entregar (p.ej. ventana de 24h). */ const STATUS_RANK = {
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4
};
/** Traduce el código de error de Meta a un motivo accionable para el
 *  comerciante; si no lo conocemos, usa el texto que manda Meta. */ function friendlyDeliveryError(err) {
  const code = Number(err?.code ?? 0);
  const known = {
    131047: "Pasaron más de 24 horas desde el último mensaje del cliente. Usá una plantilla aprobada para reabrir la conversación.",
    131026: "El mensaje no se pudo entregar. El número puede no tener WhatsApp o no poder recibir mensajes en este momento.",
    131051: "Este tipo de mensaje no está soportado.",
    131049: "WhatsApp limitó este mensaje para cuidar la experiencia del cliente. Intentá más tarde.",
    130472: "El cliente forma parte de un experimento de Meta y no puede recibir este mensaje ahora."
  };
  if (known[code]) return known[code];
  const details = err?.error_data?.details;
  const title = err?.title || err?.message || "";
  const text = details || title || "No se pudo entregar el mensaje.";
  return code ? `[${code}] ${text}` : text;
}
async function processStatuses(value) {
  const statuses = value.statuses ?? [];
  for (const s of statuses){
    const wamid = s.id ?? "";
    const status = s.status ?? "";
    if (!wamid || !STATUS_RANK[status]) continue;
    const { data: row } = await admin.from("chat_messages").select("id, delivery_status").eq("wa_message_id", wamid).maybeSingle();
    if (!row) continue;
    if ((STATUS_RANK[row.delivery_status] ?? 0) >= STATUS_RANK[status]) {
      continue;
    }
    const update = {
      delivery_status: status
    };
    if (status === "failed") {
      const errors = s.errors ?? [];
      update.delivery_error = friendlyDeliveryError(errors[0]);
    }
    await admin.from("chat_messages").update(update).eq("id", row.id);
  }
}
async function handleIncoming(body) {
  // Meta payload: entry[].changes[].{ field, value }. El field decide el flujo:
  // messages (cliente) · smb_message_echoes / history / smb_app_state_sync
  // (coexistencia). Todos rutean por metadata.phone_number_id → tenant.
  const entries = body?.entry ?? [];
  for (const entry of entries){
    const changes = entry?.changes ?? [];
    for (const change of changes){
      const field = change?.field ?? "messages";
      const value = change?.value;
      if (!value) continue;
      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const account = await accountForPhoneNumberId(phoneNumberId);
      if (!account) {
        // Números sin fila en whatsapp_accounts (p.ej. el emisor de
        // notificaciones de la plataforma): loguear los statuses para poder
        // diagnosticar entregas fallidas (el failed llega solo por acá).
        const orphanStatuses = value.statuses ?? [];
        for (const s of orphanStatuses){
          console.log("[wa-webhook] status no-CRM", JSON.stringify({
            phone_number_id: phoneNumberId,
            wamid: s.id,
            status: s.status,
            recipient: s.recipient_id,
            errors: s.errors ?? null
          }));
        }
        // Mensajes ENTRANTES al número de avisos de la plataforma → bandeja
        // de soporte + auto-respuesta (antes se botaban en silencio).
        const notifyPnid = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")?.trim();
        const inbound = value.messages ?? [];
        if (notifyPnid && phoneNumberId === notifyPnid && inbound.length > 0) {
          await handleNotifyNumberInbound(value, Deno.env.get("WHATSAPP_TOKEN")?.trim() ?? null, phoneNumberId);
        }
        continue;
      }
      switch(field){
        case "messages":
          await processCustomerMessages(account, value);
          // Bot de triaje: solo el número de soporte de la plataforma.
          if (SUPPORT_BOT_ENABLED && phoneNumberId === SUPPORT_BOT_PNID && (value.messages ?? []).length > 0) {
            await handleSupportBot(account, phoneNumberId, value);
          }
          await processStatuses(value);
          break;
        case "smb_message_echoes":
          await processEchoes(account, value);
          break;
        case "history":
          await processHistory(account, value);
          break;
        case "smb_app_state_sync":
          await processStateSync(account, value);
          break;
        default:
          break;
      }
    }
  }
}
Deno.serve(async (req)=>{
  const url = new URL(req.url);
  // 1) Verification handshake (GET).
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, {
        status: 200
      });
    }
    return new Response("Forbidden", {
      status: 403
    });
  }
  // 2) Incoming messages (POST). Always 200 quickly so Meta doesn't retry.
  if (req.method === "POST") {
    const raw = await req.text();
    const valid = await isValidSignature(raw, req.headers.get("x-hub-signature-256"));
    if (!valid) {
      console.error("[wa-webhook] invalid signature");
      return new Response("Forbidden", {
        status: 403
      });
    }
    try {
      await handleIncoming(JSON.parse(raw));
    } catch (err) {
      console.error("[wa-webhook] error", err);
    }
    return new Response("EVENT_RECEIVED", {
      status: 200
    });
  }
  return new Response("Method Not Allowed", {
    status: 405
  });
});
