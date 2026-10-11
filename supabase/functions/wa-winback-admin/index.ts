import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// wa-winback-admin — utilidad ONE-OFF interna (borrar al cerrar el blast).
//
// Gestiona la campaña de reactivación "plan_expired_winback" sobre la WABA de
// la PLATAFORMA (notificaciones, env WHATSAPP_TOKEN — NO la WABA del CRM):
//   - create_template: crea la plantilla en Meta (categoría MARKETING).
//   - status:          consulta el estado de aprobación de la plantilla.
//   - blast:           envía a los candidatos vía send-whatsapp-notification,
//                      con idempotencia en customer_success_sends
//                      (event_key "plan_expired_winback:{tenantId}").
//
// Auth: header x-admin-secret con un secret random de un solo uso. No está en
// el repo ni en crons; la invoca solo Claude/Nicolás a mano.
// =============================================================================

const GATE_SECRET = "86b7fa7b1bccd76e195839a2a2c32fbf5c9e342644328e5d";
const WABA_ID = "1038950559044032"; // WABA "CatalogoHoy" (portfolio LLC)
const TEMPLATE_NAME = "plan_expired_winback";

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WA_API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const WHATSAPP_WEBHOOK_SECRET = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GRAPH = `https://graph.facebook.com/${WA_API_VERSION}`;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Candidate = {
  tenantId: number;
  to: string;
  ownerName: string;
  planLabel: string;
  slug: string;
};

type Payload = {
  action: "create_template" | "status" | "blast";
  candidates?: Candidate[];
  dryRun?: boolean;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  if (req.headers.get("x-admin-secret") !== GATE_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!WHATSAPP_TOKEN) return json({ error: "WHATSAPP_TOKEN missing" }, 500);

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // ---------------- create_template ----------------
  if (body.action === "create_template") {
    const payload = {
      name: TEMPLATE_NAME,
      language: "es",
      category: "MARKETING",
      components: [
        {
          type: "BODY",
          text:
            "Hola {{1}} 👋\n\nTu plan {{2}} de CatalogoHoy venció, pero tu catálogo y tus productos siguen guardados tal como los dejaste.\n\nPuedes renovar cuando quieras y tu tienda vuelve a estar en línea al instante. Si tienes alguna pregunta, escríbenos — estamos para ayudarte.",
          example: { body_text: [["María", "Pro"]] },
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "URL",
              text: "Renovar mi plan",
              url: "https://catalogohoy.com/r/plan/{{1}}",
              example: ["https://catalogohoy.com/r/plan/mitienda"],
            },
          ],
        },
      ],
    };
    const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    return json({ ok: res.ok, status: res.status, result });
  }

  // ---------------- status ----------------
  if (body.action === "status") {
    const res = await fetch(
      `${GRAPH}/${WABA_ID}/message_templates?name=${TEMPLATE_NAME}&fields=name,status,category,language,components,rejected_reason`,
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
    );
    const result = await res.json();
    return json({ ok: res.ok, status: res.status, result });
  }

  // ---------------- blast ----------------
  if (body.action === "blast") {
    const candidates = body.candidates ?? [];
    if (!candidates.length) return json({ error: "No candidates" }, 400);
    if (!WHATSAPP_WEBHOOK_SECRET) {
      return json({ error: "WHATSAPP_WEBHOOK_SECRET missing" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const results: Record<string, unknown>[] = [];

    for (const c of candidates) {
      const eventKey = `plan_expired_winback:${c.tenantId}`;

      // Idempotencia: si ya se le envió, skip.
      const { data: existing } = await admin
        .from("customer_success_sends")
        .select("id")
        .eq("event_key", eventKey)
        .maybeSingle();
      if (existing) {
        results.push({ tenantId: c.tenantId, status: "already_sent" });
        continue;
      }

      if (body.dryRun) {
        results.push({ tenantId: c.tenantId, status: "dry_run_would_send", to: c.to });
        continue;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": WHATSAPP_WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          tenantId: c.tenantId,
          to: c.to,
          templateType: "plan_expired_winback",
          variables: [c.ownerName, c.planLabel],
          urlButtonParam: c.slug,
        }),
      });
      const sendResult = await res.json();

      if (res.ok && sendResult?.success && !sendResult?.skipped) {
        await admin.from("customer_success_sends").insert({
          tenant_id: c.tenantId,
          event_key: eventKey,
          channel: "whatsapp",
          recipient: c.to,
        });
        results.push({ tenantId: c.tenantId, status: "sent", messageId: sendResult.messageId });
      } else {
        results.push({ tenantId: c.tenantId, status: "failed", detail: sendResult });
      }

      // Pausa corta entre envíos para no golpear rate limits.
      await new Promise((r) => setTimeout(r, 400));
    }

    const sent = results.filter((r) => r.status === "sent").length;
    return json({ ok: true, total: candidates.length, sent, results });
  }

  return json({ error: "Unknown action" }, 400);
});
