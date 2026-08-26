import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// ig-oauth — conexión de la cuenta de Instagram del comerciante (Instagram
// Login, sin Facebook Page ni QR). Dos modos:
//
//   POST (desde el CRM, con JWT verificado A MANO — verify_jwt=false porque el
//   GET lo llama Instagram sin JWT):
//     { tenantId, returnUrl } → valida membresía del tenant y devuelve la URL
//     de autorización con un `state` firmado (HMAC) que amarra tenant+retorno.
//
//   GET (redirect de Instagram tras autorizar):
//     ?code&state → verifica el state, cambia code → token corto → token largo
//     (60 días), lee el perfil, upsertea social_accounts, suscribe webhooks y
//     redirige el navegador de vuelta al CRM (?ig=connected | ?ig=error).
//
// Al ser un redirect fijo del lado servidor, funciona para CUALQUIER dominio
// de cliente (no existe el problema de "dominios permitidos" del JS SDK).
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const IG_APP_ID = Deno.env.get("IG_APP_ID") ?? "1454226360079154";
const IG_APP_SECRET = Deno.env.get("IG_APP_SECRET") ?? "";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/ig-oauth`;
const GRAPH = "https://graph.instagram.com";
const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
].join(",");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── State firmado: base64url(tenantId|exp|returnUrl) + "." + HMAC ───────────
async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(IG_APP_SECRET || "dev-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64urlEncode(s: string): string {
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replaceAll("-", "+").replaceAll("_", "/") + pad);
}

async function makeState(tenantId: number, returnUrl: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 1800; // 30 min
  const payload = `${tenantId}|${exp}|${returnUrl}`;
  return `${b64urlEncode(payload)}.${await hmac(payload)}`;
}

async function parseState(
  state: string,
): Promise<{ tenantId: number; returnUrl: string } | null> {
  const [encoded, sig] = state.split(".");
  if (!encoded || !sig) return null;
  let payload: string;
  try {
    payload = b64urlDecode(encoded);
  } catch {
    return null;
  }
  if ((await hmac(payload)) !== sig) return null;
  const [tenantId, exp, ...rest] = payload.split("|");
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return { tenantId: Number(tenantId), returnUrl: rest.join("|") };
}

// ── POST: iniciar el flujo desde el CRM ─────────────────────────────────────
async function handleStart(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  let body: { tenantId?: number; returnUrl?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }
  const tenantId = Number(body.tenantId);
  const returnUrl = (body.returnUrl ?? "").trim();
  if (!tenantId || !/^https:\/\//.test(returnUrl)) {
    return jsonResponse({ success: false, error: "Missing tenantId/returnUrl" }, 400);
  }

  // Membresía: el usuario del JWT debe pertenecer al tenant.
  const { data: member } = await admin
    .from("users")
    .select("id, users_tenants!inner(tenant_id)")
    .eq("auth_user_id", user.id)
    .eq("users_tenants.tenant_id", tenantId)
    .maybeSingle();
  if (!member) {
    return jsonResponse({ success: false, error: "Forbidden" }, 403);
  }

  const state = await makeState(tenantId, returnUrl);
  // OJO: sin `force_reauth=true` — ese parámetro dispara un re-login interno
  // que emite el code en un contexto de redirect distinto y el intercambio
  // muere con "Error validating verification code" (y quema el code). La
  // conexión de julio funcionaba sin él.
  const url =
    `https://www.instagram.com/oauth/authorize` +
    `?client_id=${IG_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code&scope=${encodeURIComponent(SCOPES)}` +
    `&state=${encodeURIComponent(state)}`;
  return jsonResponse({ success: true, url });
}

// ── GET: redirect de Instagram con el code ──────────────────────────────────
async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const stateRaw = url.searchParams.get("state") ?? "";
  const state = await parseState(stateRaw);

  const back = (suffix: string): Response =>
    new Response(null, {
      status: 302,
      headers: { Location: `${state?.returnUrl ?? "https://catalogohoy.com"}${suffix}` },
    });

  if (!code || !state) return back("?ig=error");

  try {
    // 1) code → token corto (+ IGSID del comerciante). Instagram valida el
    //    redirect_uri contra el REGISTRADO en el panel; si difieren solo en la
    //    barra final (clásico de Meta/TikTok), reintentamos con la variante.
    const exchange = async (redirectUri: string) => {
      const form = new URLSearchParams({
        client_id: IG_APP_ID,
        client_secret: IG_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      });
      const res = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        body: form,
      });
      return { ok: res.ok, json: await res.json() };
    };

    let attempt = await exchange(REDIRECT_URI);
    if (!attempt.ok || !attempt.json?.access_token) {
      const alt = REDIRECT_URI.endsWith("/")
        ? REDIRECT_URI.slice(0, -1)
        : `${REDIRECT_URI}/`;
      console.error(
        "[ig-oauth] short token error (1er intento, redirect sin alternar)",
        JSON.stringify(attempt.json),
      );
      attempt = await exchange(alt);
      if (attempt.ok && attempt.json?.access_token) {
        console.log("[ig-oauth] el intercambio funcionó con la variante:", alt);
      }
    }
    if (!attempt.ok || !attempt.json?.access_token) {
      console.error("[ig-oauth] short token error (ambas variantes)", JSON.stringify(attempt.json));
      return back("?ig=error");
    }
    const short = attempt.json;

    // 2) token corto → long-lived (60 días).
    const longRes = await fetch(
      `${GRAPH}/access_token?grant_type=ig_exchange_token` +
        `&client_secret=${IG_APP_SECRET}&access_token=${short.access_token}`,
    );
    const long = await longRes.json();
    const accessToken: string = long?.access_token ?? short.access_token;
    const expiresIn: number = Number(long?.expires_in ?? 60 * 24 * 3600);

    // 3) Perfil de la cuenta conectada.
    const meRes = await fetch(
      `${GRAPH}/v23.0/me?fields=user_id,username,name&access_token=${accessToken}`,
    );
    const me = await meRes.json();
    const igUserId = String(me?.user_id ?? short?.user_id ?? "");
    if (!igUserId) return back("?ig=error");

    // 4) Guardar la cuenta del tenant. OJO: verificar el error — antes un
    //    fallo acá seguía de largo y redirigía "?ig=connected" sin guardar.
    const { error: saveError } = await admin.from("social_accounts").upsert(
      {
        tenant_id: state.tenantId,
        channel: "instagram",
        external_account_id: igUserId,
        username: me?.username ?? null,
        display_name: me?.name ?? null,
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        status: "active",
      },
      { onConflict: "channel,external_account_id" },
    );
    if (saveError) {
      console.error("[ig-oauth] upsert social_accounts fallo", JSON.stringify(saveError));
      return back("?ig=error");
    }

    // 4b) Una sola cuenta ACTIVA por tenant+canal: desactivar cualquier otra
    //     (p. ej. la cuenta DEMO del catálogo de demostración, o una cuenta
    //     anterior). Con 2 activas, ig-send hace .maybeSingle() y falla.
    await admin
      .from("social_accounts")
      .update({ status: "inactive" })
      .eq("tenant_id", state.tenantId)
      .eq("channel", "instagram")
      .neq("external_account_id", igUserId);

    // 5) Suscribir la cuenta a los webhooks de mensajes + comentarios.
    await fetch(
      `${GRAPH}/v23.0/${igUserId}/subscribed_apps?subscribed_fields=messages,comments&access_token=${accessToken}`,
      { method: "POST" },
    );

    return back("?ig=connected");
  } catch (err) {
    console.error("[ig-oauth] callback error", err);
    return back("?ig=error");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method === "POST") return handleStart(req);
  if (req.method === "GET") return handleCallback(req);
  return jsonResponse({ success: false, error: "Method Not Allowed" }, 405);
});
