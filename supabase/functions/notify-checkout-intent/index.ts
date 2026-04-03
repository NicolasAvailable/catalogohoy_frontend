import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_CHECKOUT_INTENT_WEBHOOK");

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

  if (!DISCORD_WEBHOOK_URL) {
    console.error("DISCORD_CHECKOUT_INTENT_WEBHOOK not configured");
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

    const embed = {
      title: "🔥 Checkout Intent",
      color: 0x6366f1,
      fields: [
        { name: "Negocio", value: name, inline: true },
        { name: "Slug", value: slug, inline: true },
        { name: "Email", value: user.email ?? "—", inline: true },
        {
          name: "Plan",
          value: `Plan ${planName}`,
          inline: true,
        },
        {
          name: "Periodo",
          value: periodLabels[billingPeriod] ?? billingPeriod,
          inline: true,
        },
        { name: "Fecha", value: now, inline: false },
      ],
    };

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("notify-checkout-intent error:", err);
    return jsonResponse({ success: true });
  }
});
