// platform-capi — eventos del navegador del funnel de CatalogoHoy que también
// mandamos server-side al píxel propio (Conversions API), para no perderlos por
// bloqueadores, iOS/ITP o el webview de la app.
//
// Hoy solo: CompleteRegistration. Lo llama el signup justo después de crear la
// cuenta, con el MISMO eventId que usa fbq(..., {eventID}) → Meta deduplica.
// Requiere JWT del usuario recién registrado (el email/país salen de la DB, no
// del body). Pagos NO pasan por acá: salen de stripe-webhook / revenuecat-webhook.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendPlatformEvent } from "../_shared/meta-platform-capi.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ALLOWED = new Set(["CompleteRegistration"]);
const str = (v: unknown, max = 500) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "method" }, 405);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ success: false, error: "Unauthorized" }, 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON" }, 400); }

  const eventName = str(body?.eventName, 40);
  const eventId = str(body?.eventId, 100);
  if (!eventName || !ALLOWED.has(eventName) || !eventId) {
    return json({ success: false, error: "bad_event" }, 400);
  }

  // Un registro por cuenta: si la cuenta tiene más de 1 día, no es un registro.
  const createdMs = user.created_at ? Date.parse(user.created_at) : 0;
  if (createdMs && Date.now() - createdMs > 24 * 3600 * 1000) {
    return json({ success: true, skipped: true, reason: "cuenta antigua" });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: u } = await admin
    .from("users")
    .select("email, phone, name, last_name, country_code")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const result = await sendPlatformEvent({
    eventName: "CompleteRegistration",
    eventId,
    actionSource: "website",
    sourceUrl: str(body?.sourceUrl, 1000),
    email: u?.email ?? user.email ?? null,
    phone: u?.phone ?? null,
    firstName: u?.name ?? null,
    lastName: u?.last_name ?? null,
    country: u?.country_code ?? null,
    externalId: user.id,
    clientIp: ip,
    clientUserAgent: req.headers.get("user-agent"),
    fbp: str(body?.fbp, 200),
    fbc: str(body?.fbc, 300),
  });
  return json({ success: true, ...result });
});
