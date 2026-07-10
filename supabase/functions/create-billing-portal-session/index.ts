import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

// Crea una sesión del Stripe Billing Portal para que el OWNER del tenant
// actualice su tarjeta (y vea su historial de facturas). La configuration del
// portal se restringe a payment_method_update — cancelar/cambiar plan siguen
// pasando por nuestros flujos. El return_url se construye server-side con el
// slug del tenant para no aceptar redirects arbitrarios del cliente.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PORTAL_LOCALES = new Set(["es", "en", "fr", "pt"]);

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Reusa (o crea una vez) la configuration del portal marcada con nuestra
 *  metadata. Así el portal queda igual aunque cambie el default del dashboard. */
async function getPortalConfiguration(stripe: Stripe): Promise<string> {
  const configs = await stripe.billingPortal.configurations.list({ limit: 100 });
  const existing = configs.data.find(
    (c) => c.metadata?.catalogohoy_purpose === "card_update" && c.active
  );
  if (existing) return existing.id;

  const created = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "CatalogoHoy — método de pago" },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
    metadata: { catalogohoy_purpose: "card_update" },
  });
  return created.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return json({ error: "Stripe no configurado" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
  const authUserId = userRes.user.id;

  let body: { tenantId?: number | string; locale?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const tenantId = body.tenantId == null ? null : Number(body.tenantId);
  if (!tenantId || Number.isNaN(tenantId)) {
    return json({ error: "tenantId is required" }, 400);
  }

  // Solo el owner del tenant puede tocar la facturación (mismo criterio que
  // get-billing-history).
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: ownerRow } = await admin
    .from("users_tenants")
    .select("users!inner(auth_user_id)")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerAuthId = (ownerRow as any)?.users?.auth_user_id ?? null;
  if (!ownerAuthId || ownerAuthId !== authUserId) {
    return json({ error: "Forbidden" }, 403);
  }

  const { data: tenantRow } = await admin
    .from("tenants")
    .select("stripe_customer_id, slug")
    .eq("id", tenantId)
    .maybeSingle();
  const tenant = tenantRow as { stripe_customer_id?: string | null; slug?: string | null } | null;
  const customerId = tenant?.stripe_customer_id ?? null;
  if (!customerId) {
    // Tenant con pago manual (pago móvil / transferencia): no hay tarjeta.
    return json({ error: "no_stripe_customer" }, 404);
  }

  const returnUrl = tenant?.slug
    ? `https://${tenant.slug}.catalogohoy.com/admin/profile`
    : "https://catalogohoy.com";

  try {
    const stripe = new Stripe(stripeKey);
    const configuration = await getPortalConfiguration(stripe);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration,
      return_url: returnUrl,
      locale: PORTAL_LOCALES.has(body.locale ?? "")
        ? (body.locale as Stripe.BillingPortal.SessionCreateParams.Locale)
        : "es",
    });
    return json({ url: session.url });
  } catch (err) {
    console.error("billingPortal session failed:", err);
    return json({ error: "No se pudo crear la sesión del portal" }, 500);
  }
});
