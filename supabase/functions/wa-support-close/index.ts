import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// wa-support-close — cierre por inactividad de las conversaciones del número
// de SOPORTE de la plataforma (tenant 6), estilo Zinli: si pasaron
// CLOSE_AFTER_MIN minutos sin actividad en un chat donde el negocio participó,
// se avisa que la conversación quedó cerrada y que puede reabrirse
// escribiendo. wa-webhook detecta ese mensaje por su prefijo y vuelve a
// mostrar el menú de triaje cuando el cliente reescribe.
//
// Lo dispara pg_cron cada 10 min (net.http_post con x-webhook-secret).
// Opts (body JSON): dryRun (lista candidatos sin enviar) · closeAfterMin
// (override para pruebas) · onlyChatId (limitar a un chat).
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const SECRET = Deno.env.get("WA_SUPPORT_CLOSE_SECRET") ?? null;

const SUPPORT_TENANT_ID = 6;
const SUPPORT_BOT_PNID = Deno.env.get("WA_SUPPORT_BOT_PNID") ?? "1011157635415699";
const BOT_ENABLED = (Deno.env.get("WA_SUPPORT_BOT") ?? "on") !== "off";
const CLOSE_AFTER_MIN = Number(Deno.env.get("WA_SUPPORT_CLOSE_AFTER_MIN") ?? 30);

// ⚠️ Mantener el prefijo sincronizado con SUPPORT_CLOSE_PREFIX en wa-webhook:
// es el marcador con el que el webhook reconoce una conversación cerrada.
const CLOSE_PREFIX = "Esta conversación se cerró por inactividad";
const CLOSE_BODY = CLOSE_PREFIX + " ⏳\n\n" +
  "Si necesitás algo más, escribí «hola» y arrancamos de nuevo. ¡Hasta pronto! 👋";

// Prefijos de TODO lo que envía el bot de triaje (wa-webhook) — ⚠️ mantener
// sincronizados con SUPPORT_MENU_BODY / SUPPORT_MENU_OPTIONS / flujo VE.
// Un mensaje is_mine que NO empiece con uno de estos es de un agente HUMANO:
// esa conversación está siendo atendida y NO se auto-cierra (feedback
// 2026-08-26: el cierre interrumpía un caso en curso con moto Fox).
const BOT_MESSAGE_PREFIXES = [
  CLOSE_PREFIX,
  "¡Hola! 👋 Escribiste al soporte de CatalogoHoy.",
  "Contanos tu problema con el mayor detalle posible",
  "Para pagar o renovar tu plan tenés dos caminos:",
  "¡Dale! Contanos tu consulta",
  "¡Excelente elección",
  "Datos de *Pago móvil*",
  "Datos de *Transferencia bancaria*",
];
const isBotMessage = (content: unknown): boolean =>
  BOT_MESSAGE_PREFIXES.some((p) => String(content ?? "").startsWith(p));

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  if (!SECRET || req.headers.get("x-webhook-secret") !== SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!BOT_ENABLED) return json({ closed: 0, disabled: true });

  let opts: { dryRun?: boolean; closeAfterMin?: number; onlyChatId?: number };
  try {
    opts = req.method === "POST" ? await req.json() : {};
  } catch {
    opts = {};
  }
  const closeAfterMin = Number(opts.closeAfterMin ?? CLOSE_AFTER_MIN);

  // Token del número de soporte (mismo que usa el CRM para responder).
  const { data: account } = await admin
    .from("whatsapp_accounts")
    .select("access_token")
    .eq("phone_number_id", SUPPORT_BOT_PNID)
    .eq("status", "active")
    .maybeSingle();
  const token = account?.access_token ?? null;
  if (!token) return json({ error: "support number token not found" }, 500);

  // Candidatos: chats de soporte sin actividad hace >= closeAfterMin, pero con
  // actividad dentro de las últimas 20h (margen sobre la ventana de 24h de la
  // Cloud API: fuera de ella el cierre no se podría entregar).
  const now = Date.now();
  const cutoff = new Date(now - closeAfterMin * 60_000).toISOString();
  const windowStart = new Date(now - 20 * 3600 * 1000).toISOString();
  const { data: chats } = await admin
    .from("chats")
    .select("id, customer_phone, last_message_at")
    .eq("tenant_id", SUPPORT_TENANT_ID)
    .lte("last_message_at", cutoff)
    .gte("last_message_at", windowStart);

  const candidates: Array<{ chatId: number; phone: string }> = [];
  for (const chat of chats ?? []) {
    if (opts.onlyChatId && chat.id !== opts.onlyChatId) continue;
    if (!chat.customer_phone) continue;

    const { data: msgs } = await admin
      .from("chat_messages")
      .select("content, is_mine, created_at")
      .eq("chat_id", chat.id)
      .not("is_internal", "is", true)
      .order("created_at", { ascending: false })
      .limit(30);
    const history = msgs ?? [];
    if (!history.length) continue;

    // Ya cerrada (el último mensaje del negocio es el aviso de cierre).
    const latest = history[0];
    if (latest.is_mine && String(latest.content ?? "").startsWith(CLOSE_PREFIX)) continue;

    // Solo se cierran sesiones donde el BOT tuvo la última palabra: si el
    // último mensaje es del cliente, está esperando respuesta nuestra — un
    // "cerrado por inactividad" ahí sería dejarlo plantado.
    if (!latest.is_mine) continue;

    // El último mensaje del CLIENTE debe estar dentro de la ventana de envío.
    const lastCustomer = history.find((m) => !m.is_mine);
    if (!lastCustomer) continue;
    if (new Date(lastCustomer.created_at).getTime() < now - 20 * 3600 * 1000) continue;

    // Solo sesiones atendidas ÚNICAMENTE por el bot: si un agente humano
    // escribió algo en la ventana, la conversación está siendo atendida y el
    // cierre automático solo molesta.
    const mineMsgs = history.filter((m) => m.is_mine);
    if (!mineMsgs.length) continue;
    if (!mineMsgs.every((m) => isBotMessage(m.content))) continue;

    candidates.push({ chatId: chat.id, phone: chat.customer_phone });
  }

  if (opts.dryRun) return json({ dryRun: true, count: candidates.length, candidates });

  let closed = 0;
  for (const c of candidates) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${API_VERSION}/${SUPPORT_BOT_PNID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: c.phone,
            type: "text",
            text: { body: CLOSE_BODY },
          }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("[wa-support-close] send fallo", c.chatId, res.status, JSON.stringify(body)?.slice(0, 300));
        continue;
      }
      const wamid = body?.messages?.[0]?.id ?? null;
      await admin.from("chat_messages").insert({
        chat_id: c.chatId,
        content: CLOSE_BODY,
        is_mine: true,
        message_type: "text",
        wa_message_id: wamid,
      });
      await admin.from("chats").update({
        last_message: CLOSE_BODY,
        last_message_at: new Date().toISOString(),
        last_message_is_mine: true,
      }).eq("id", c.chatId);
      closed++;
    } catch (e) {
      console.error("[wa-support-close] error", c.chatId, e instanceof Error ? e.message : String(e));
    }
  }

  return json({ closed, candidates: candidates.length });
});
