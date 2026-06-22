import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Confirma una compra de pack de créditos tras el redirect de éxito de Stripe.
// Recupera la sesión, verifica que esté pagada y que pertenezca al usuario, y
// acredita el saldo. Idempotente: el unique de stripe_session_id evita acreditar
// dos veces aunque se llame varias veces (refresh, doble click, etc.).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
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
  if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ success: false, error: "Unauthorized" }, 401);

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }
  const sessionId = (body.sessionId ?? "").trim();
  if (!sessionId.startsWith("cs_")) {
    return json({ success: false, error: "Sesión inválida" }, 400);
  }

  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret) return json({ success: false, error: "Stripe no configurado" }, 500);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: ownerRow } = await admin
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const ownerId = (ownerRow as { id?: number } | null)?.id;
  if (!ownerId) return json({ success: false, error: "Usuario no encontrado" }, 403);

  try {
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.type !== "credit_pack") {
      return json({ success: false, error: "Sesión no es de créditos" }, 400);
    }
    // Solo el dueño de la sesión puede confirmarla.
    if (Number(session.metadata?.owner_id) !== ownerId) {
      return json({ success: false, error: "No autorizado" }, 403);
    }
    if (session.payment_status !== "paid") {
      return json({ success: true, paid: false });
    }

    const credits = Number(session.metadata?.credits);
    let added = 0;
    if (Number.isFinite(credits) && credits > 0) {
      // Idempotencia: insert con unique(stripe_session_id). Si ya existe,
      // insErr (unique_violation) → no acreditamos de nuevo.
      const { error: insErr } = await admin.from("ai_credit_purchases").insert({
        stripe_session_id: session.id,
        user_id: ownerId,
        credits,
        amount: session.amount_total,
        currency: session.currency,
      });
      if (!insErr) {
        await admin.rpc("add_purchased_credits", {
          p_user_id: ownerId,
          p_amount: credits,
        });
        added = credits;
      }
    }

    const { data: bal } = await admin
      .from("ai_credits")
      .select("monthly_balance, purchased_balance")
      .eq("user_id", ownerId)
      .maybeSingle();
    const total = ((bal as { monthly_balance?: number; purchased_balance?: number } | null)
      ?.monthly_balance ?? 0) +
      ((bal as { purchased_balance?: number } | null)?.purchased_balance ?? 0);

    return json({ success: true, paid: true, added, credits: total });
  } catch (err) {
    console.error("confirm-credit-purchase error:", err);
    return json({ success: false, error: "No se pudo confirmar la compra." }, 500);
  }
});
