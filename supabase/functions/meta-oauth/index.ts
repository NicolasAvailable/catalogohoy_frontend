import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// meta-oauth — "Conectar Meta" (Facebook Login for Business). Base compartida de
// CAT-64 (Commerce Catalog + feed) y CAT-65 (Pixel/CAPI por OAuth). Espejo de
// fb-oauth, pero pide permisos de catálogo/ads y guarda la conexión de negocio
// por tenant en meta_business_connections.
//
//   POST (desde el panel, JWT verificado a mano; verify_jwt=false porque el GET
//   lo llama Meta sin JWT):
//     { tenantId, returnUrl } → valida membresía y devuelve la URL de
//     autorización con un `state` firmado (HMAC) que amarra tenant+retorno.
//
//   GET (redirect de Meta tras autorizar):
//     ?code&state → verifica state, code → user token → long-lived, lista los
//     Businesses del usuario (todos van a metadata.businesses para el selector),
//     upsertea meta_business_connections y redirige al panel
//     (?meta=connected | ?meta=error). Si ya había un business elegido y sigue
//     disponible, se respeta (reconectar no pisa la elección).
//
// Requiere en Meta: permisos business_management + catalog_management +
// ads_management. En Dev Mode funciona para admins/devs/testers de la app; para
// producción hace falta App Review (Advanced Access) — CAT-64/65.
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// Misma app de Meta que WhatsApp/Messenger (fb-oauth): reusamos sus secrets.
const FB_APP_ID = Deno.env.get("FB_APP_ID") ?? Deno.env.get("WA_APP_ID") ?? "";
const FB_APP_SECRET = Deno.env.get("FB_APP_SECRET") ?? Deno.env.get("WA_APP_SECRET") ?? "";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/meta-oauth`;
const GRAPH = "https://graph.facebook.com/v23.0";
const SCOPES = [
  "business_management",
  "catalog_management", // CAT-64: Commerce Catalog + feed de productos
  "ads_management",     // CAT-65: Pixel/dataset + Conversions API
].join(",");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── State firmado: base64url(tenantId|exp|returnUrl) + "." + HMAC ───────────
async function hmac(data) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(FB_APP_SECRET || "dev-secret"),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function b64urlEncode(s) { return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function b64urlDecode(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replaceAll("-", "+").replaceAll("_", "/") + pad);
}
async function makeState(tenantId, returnUrl) {
  const exp = Math.floor(Date.now() / 1000) + 1800; // 30 min
  const payload = `${tenantId}|${exp}|${returnUrl}`;
  return `${b64urlEncode(payload)}.${await hmac(payload)}`;
}
async function parseState(state) {
  const [encoded, sig] = (state ?? "").split(".");
  if (!encoded || !sig) return null;
  let payload;
  try { payload = b64urlDecode(encoded); } catch { return null; }
  if ((await hmac(payload)) !== sig) return null;
  const [tenantId, exp, ...rest] = payload.split("|");
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return { tenantId: Number(tenantId), returnUrl: rest.join("|") };
}

// ── POST: iniciar el flujo desde el panel ───────────────────────────────────
async function handleStart(req) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

  let body;
  try { body = await req.json(); } catch { return jsonResponse({ success: false, error: "Invalid JSON" }, 400); }
  const tenantId = Number(body.tenantId);
  const returnUrl = (body.returnUrl ?? "").trim();
  if (!tenantId || !/^https:\/\//.test(returnUrl)) {
    return jsonResponse({ success: false, error: "Missing tenantId/returnUrl" }, 400);
  }
  if (!FB_APP_ID) return jsonResponse({ success: false, error: "Meta no está configurado (falta FB_APP_ID)" }, 503);

  const { data: member } = await admin
    .from("users").select("id, users_tenants!inner(tenant_id)")
    .eq("auth_user_id", user.id).eq("users_tenants.tenant_id", tenantId).maybeSingle();
  if (!member) return jsonResponse({ success: false, error: "Forbidden" }, 403);

  const state = await makeState(tenantId, returnUrl);
  const url =
    `https://www.facebook.com/v23.0/dialog/oauth?client_id=${FB_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code&scope=${encodeURIComponent(SCOPES)}` +
    `&state=${encodeURIComponent(state)}`;
  return jsonResponse({ success: true, url });
}

// ── GET: redirect de Meta con el code ───────────────────────────────────────
async function handleCallback(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = await parseState(url.searchParams.get("state") ?? "");
  const back = (suffix) => new Response(null, {
    status: 302,
    headers: { Location: `${state?.returnUrl ?? "https://catalogohoy.com"}${suffix}` },
  });
  if (!code || !state) return back("?meta=error");

  try {
    // 1) code → user token (corto)
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${FB_APP_ID}` +
      `&client_secret=${FB_APP_SECRET}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&code=${encodeURIComponent(code)}`);
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson?.access_token) {
      console.error("[meta-oauth] token error", JSON.stringify(tokenJson));
      return back("?meta=error");
    }
    // 2) → long-lived (60d)
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}` +
      `&fb_exchange_token=${tokenJson.access_token}`);
    const longJson = await longRes.json();
    const userToken = longJson?.access_token ?? tokenJson.access_token;
    const expiresIn = Number(longJson?.expires_in ?? 0);
    const expiresAt = expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : new Date(Date.now() + 60 * 86400_000).toISOString();

    // 3) Businesses que administra el usuario: todos al metadata (selector en el
    //    panel); si reconecta y su elección previa sigue vigente, se respeta.
    const bizRes = await fetch(`${GRAPH}/me/businesses?fields=id,name&limit=50&access_token=${userToken}`);
    const bizJson = await bizRes.json();
    const businesses = (bizJson?.data ?? []).map((b) => ({ id: b.id, name: b.name }));

    const { data: existing } = await admin
      .from("meta_business_connections")
      .select("business_id, metadata")
      .eq("tenant_id", state.tenantId)
      .maybeSingle();
    const keepCurrent = existing?.business_id &&
      businesses.some((b) => b.id === existing.business_id);
    const selected = keepCurrent
      ? businesses.find((b) => b.id === existing.business_id)
      : (businesses[0] ?? null);

    // 4) guardar conexión (token server-only); metadata preserva claves previas
    //    (p.ej. feed_id del catálogo) y refresca scopes + businesses.
    await admin.from("meta_business_connections").upsert({
      tenant_id: state.tenantId,
      access_token: userToken,
      token_expires_at: expiresAt,
      business_id: selected?.id ?? null,
      business_name: selected?.name ?? null,
      status: "connected",
      metadata: { ...(existing?.metadata ?? {}), scopes: SCOPES, businesses },
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id" });

    return back(selected ? "?meta=connected" : "?meta=connected_nobusiness");
  } catch (err) {
    console.error("[meta-oauth] callback error", err);
    return back("?meta=error");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "POST") return handleStart(req);
  if (req.method === "GET") return handleCallback(req);
  return jsonResponse({ success: false, error: "Method Not Allowed" }, 405);
});
