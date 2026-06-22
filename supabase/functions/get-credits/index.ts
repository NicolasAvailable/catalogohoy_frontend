import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Devuelve el saldo de créditos de IA del owner. Llama a ensure_ai_credits
// primero, así un owner nuevo (sin fila) recibe su allowance del plan antes de
// leer. Lo usa el frontend para mostrar "X créditos".

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

  await admin.rpc("ensure_ai_credits", { p_user_id: ownerId });
  const { data: bal } = await admin
    .from("ai_credits")
    .select("monthly_balance, purchased_balance, monthly_allowance, reset_at")
    .eq("user_id", ownerId)
    .maybeSingle();

  const row = bal as {
    monthly_balance?: number;
    purchased_balance?: number;
    monthly_allowance?: number;
    reset_at?: string;
  } | null;
  const monthly = row?.monthly_balance ?? 0;
  const purchased = row?.purchased_balance ?? 0;

  return json({
    success: true,
    credits: monthly + purchased,
    monthly,
    purchased,
    allowance: row?.monthly_allowance ?? 0,
    resetAt: row?.reset_at ?? null,
  });
});
