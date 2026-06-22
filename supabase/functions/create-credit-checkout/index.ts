import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Crea una sesión de Stripe Checkout (pago único) para comprar créditos de IA.
// El usuario arma su paquete (cantidad libre); el precio y el descuento por
// volumen se calculan SIEMPRE en el servidor (nunca se confía en el cliente).
// price_data inline → no requiere productos/precios pre-creados en Stripe. El
// fulfillment lo hace `confirm-credit-purchase` al volver del éxito (idempotente
// por session_id).

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

// ── Pricing de créditos (autoritativo) ──────────────────────────────────────
// Precio base por crédito (centavos USD) + descuento por volumen. El front
// replica esta misma tabla solo para mostrar; el cobro real es este.
const BASE_CENTS_PER_CREDIT = 1.9; // $0.019 / crédito
const MIN_CREDITS = 100;
const MAX_CREDITS = 5000;
const STEP = 50;

function volumeDiscount(credits: number): number {
  if (credits >= 2000) return 0.10;
  if (credits >= 1000) return 0.08;
  if (credits >= 600) return 0.06;
  if (credits >= 300) return 0.05;
  return 0;
}

// Normaliza al rango/paso válido (entero, múltiplo de STEP, dentro de límites).
function normalizeCredits(raw: number): number {
  if (!Number.isFinite(raw)) return MIN_CREDITS;
  let c = Math.round(raw / STEP) * STEP;
  if (c < MIN_CREDITS) c = MIN_CREDITS;
  if (c > MAX_CREDITS) c = MAX_CREDITS;
  return c;
}

function priceCents(credits: number): number {
  const discount = volumeDiscount(credits);
  return Math.round(credits * BASE_CENTS_PER_CREDIT * (1 - discount));
}

// Compat: packs viejos (por si algún cliente cacheado los manda).
const LEGACY_PACK_CREDITS: Record<string, number> = { "150": 150, "500": 500 };

// Evita open-redirect: solo dominios catalogohoy o localhost (dev).
function safeReturn(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const ok = (u.protocol === "https:" &&
      (u.hostname === "catalogohoy.com" || u.hostname.endsWith(".catalogohoy.com"))) ||
      u.hostname === "localhost";
    return ok ? url : null;
  } catch {
    return null;
  }
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

  let body: { credits?: number; packId?: string; returnUrl?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  // Resolver la cantidad de créditos: cantidad libre o pack legacy.
  const rawCredits = typeof body.credits === "number"
    ? body.credits
    : LEGACY_PACK_CREDITS[body.packId ?? ""];
  if (!rawCredits) {
    return json({ success: false, error: "Cantidad inválida" }, 400);
  }
  const credits = normalizeCredits(rawCredits);
  const amount = priceCents(credits);

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

  const base = safeReturn(body.returnUrl) ?? "https://catalogohoy.com/admin";

  try {
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: { name: `${credits} créditos de IA` },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "credit_pack",
        owner_id: String(ownerId),
        credits: String(credits),
      },
      success_url: `${base}?credits_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}?credits=cancel`,
    });
    return json({ success: true, url: session.url });
  } catch (err) {
    console.error("create-credit-checkout error:", err);
    return json({ success: false, error: "No se pudo iniciar el pago." }, 500);
  }
});
