import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_CHECKOUT_INTENT_WEBHOOK");

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

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  if (!SLACK_WEBHOOK_URL) {
    console.error("SLACK_CHECKOUT_INTENT_WEBHOOK not configured");
    return jsonResponse({ success: true });
  }

  try {
    const { tenantName, tenantSlug, planName, billingPeriod } =
      (await req.json()) as {
        tenantName: string | null;
        tenantSlug: string | null;
        planName: string;
        billingPeriod: string;
      };

    const slug = tenantSlug ?? "desconocido";
    const name = tenantName ?? slug;
    const now = new Date().toLocaleString("es-VE", {
      timeZone: "America/Caracas",
    });

    const periodLabels: Record<string, string> = {
      monthly: "Mensual",
      quarterly: "Trimestral",
      annual: "Anual",
    };

    const periodo = periodLabels[billingPeriod] ?? billingPeriod;

    // Slack Block Kit: barra de color vía attachment, campos en dos columnas.
    const payload = {
      attachments: [
        {
          color: "#6366f1",
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "🔥 Checkout Intent", emoji: true },
            },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Negocio:*\n${name}` },
                { type: "mrkdwn", text: `*Slug:*\n${slug}` },
                { type: "mrkdwn", text: `*Email:*\n${user.email ?? "—"}` },
                { type: "mrkdwn", text: `*Plan:*\nPlan ${planName}` },
                { type: "mrkdwn", text: `*Periodo:*\n${periodo}` },
                { type: "mrkdwn", text: `*Fecha:*\n${now}` },
              ],
            },
          ],
        },
      ],
    };

    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("notify-checkout-intent error:", err);
    return jsonResponse({ success: true });
  }
});
