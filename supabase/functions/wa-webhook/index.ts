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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function digits(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Resolve the tenant that owns the WhatsApp phone_number_id the message hit. */
async function tenantForPhoneNumberId(
  phoneNumberId: string,
): Promise<number | null> {
  const { data } = await admin
    .from("whatsapp_accounts")
    .select("tenant_id")
    .eq("phone_number_id", phoneNumberId)
    .eq("status", "active")
    .maybeSingle();
  return data?.tenant_id ?? null;
}

/** Find-or-create the conversation for (tenant, customer phone). */
async function findOrCreateChat(
  tenantId: number,
  phone: string,
  name: string | null,
): Promise<number | null> {
  const { data: existing } = await admin
    .from("chats")
    .select("id, customer_phone")
    .eq("tenant_id", tenantId);

  const match = (existing ?? []).find(
    (c: { customer_phone: string | null }) =>
      digits(c.customer_phone ?? "") === digits(phone),
  );
  if (match) return match.id;

  const { data: created } = await admin
    .from("chats")
    .insert({ tenant_id: tenantId, customer_phone: phone, customer_name: name })
    .select("id")
    .single();
  return created?.id ?? null;
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

      const tenantId = await tenantForPhoneNumberId(phoneNumberId);
      if (!tenantId) continue;

      const contacts = (value.contacts as { profile?: { name?: string } }[]) ?? [];
      const profileName = contacts[0]?.profile?.name ?? null;

      for (const m of messages as { from?: string; text?: { body?: string } }[]) {
        const from = m.from ?? "";
        const text = m.text?.body ?? "";
        if (!from || !text) continue;

        const chatId = await findOrCreateChat(tenantId, from, profileName);
        if (!chatId) continue;

        await admin
          .from("chat_messages")
          .insert({ chat_id: chatId, content: text, is_mine: false });

        await admin
          .from("chats")
          .update({
            last_message: text,
            last_message_at: new Date().toISOString(),
          })
          .eq("id", chatId);
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
    try {
      const body = await req.json();
      await handleIncoming(body);
    } catch (err) {
      console.error("[wa-webhook] error", err);
    }
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
});
