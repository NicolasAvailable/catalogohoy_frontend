import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// fb-oauth — conexión de la Página de Facebook del comerciante (Facebook Login
// for Business → Messenger). Espejo de ig-oauth. Dos modos:
//
//   POST (desde el CRM, JWT verificado A MANO — verify_jwt=false porque el GET
//   lo llama Facebook sin JWT):
//     { tenantId, returnUrl } → valida membresía del tenant y devuelve la URL
//     de autorización con un `state` firmado (HMAC) que amarra tenant+retorno.
//
//   GET (redirect de Facebook tras autorizar):
//     ?code&state → verifica el state, cambia code → user token → long-lived,
//     lista las páginas (/me/accounts), toma la primera, upsertea
//     social_accounts (channel='messenger', PAGE_ID + page access token),
//     suscribe la Página al webhook de la app y redirige al CRM
//     (?fb=connected | ?fb=error).
//
// Al ser un redirect fijo del lado servidor, funciona para CUALQUIER dominio
// de cliente (no existe el problema de "dominios permitidos" del JS SDK).
//
// Requiere en Meta: producto Messenger en la app + permisos pages_messaging /
// pages_manage_metadata / pages_show_list (App Review para producción).
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// Misma app de Meta que WhatsApp (Embedded Signup, id 1533064975039243):
// si no hay secrets FB_* dedicados, caemos a los WA_* que ya están en prod.
const FB_APP_ID = Deno.env.get("FB_APP_ID") ?? Deno.env.get("WA_APP_ID") ?? "";
const FB_APP_SECRET = Deno.env.get("FB_APP_SECRET") ?? Deno.env.get("WA_APP_SECRET") ?? "";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/fb-oauth`;
const GRAPH = "https://graph.facebook.com/v23.0";
const SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",   // leer comentarios de los posts de la Página
  "pages_manage_engagement", // responder/ocultar comentarios
  "business_management",
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
    new TextEncoder().encode(FB_APP_SECRET || "dev-secret"),
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
  if (!FB_APP_ID) {
    return jsonResponse(
      { success: false, error: "Messenger no está configurado (falta FB_APP_ID)" },
      503,
    );
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
  const url =
    `https://www.facebook.com/v23.0/dialog/oauth?client_id=${FB_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code&scope=${encodeURIComponent(SCOPES)}` +
    `&state=${encodeURIComponent(state)}`;
  return jsonResponse({ success: true, url });
}

// ── GET: redirect de Facebook con el code ───────────────────────────────────
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

  if (!code || !state) return back("?fb=error");

  try {
    // 1) code → user access token (corto).
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${FB_APP_ID}` +
        `&client_secret=${FB_APP_SECRET}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&code=${encodeURIComponent(code)}`,
    );
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson?.access_token) {
      console.error("[fb-oauth] token error", JSON.stringify(tokenJson));
      return back("?fb=error");
    }

    // 2) user token corto → long-lived (60 días). Los page tokens derivados de
    //    un user token long-lived NO expiran.
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
        `&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}` +
        `&fb_exchange_token=${tokenJson.access_token}`,
    );
    const longJson = await longRes.json();
    const userToken: string = longJson?.access_token ?? tokenJson.access_token;

    // 3) Páginas que administra el usuario (con sus page access tokens).
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,access_token&access_token=${userToken}`,
    );
    const pagesJson = await pagesRes.json();
    const page = (pagesJson?.data ?? [])[0];
    if (!page?.id || !page?.access_token) {
      console.error("[fb-oauth] no pages", JSON.stringify(pagesJson));
      return back("?fb=error");
    }

    // 4) Guardar la Página del tenant.
    await admin.from("social_accounts").upsert(
      {
        tenant_id: state.tenantId,
        channel: "messenger",
        external_account_id: String(page.id),
        username: null,
        display_name: page.name ?? null,
        access_token: page.access_token,
        token_expires_at: null,
        status: "active",
      },
      { onConflict: "channel,external_account_id" },
    );

    // 4b) Una sola Página ACTIVA por tenant: desactivar cualquier otra (p. ej.
    //     la DEMO del catálogo de demostración). Con 2 activas, fb-send hace
    //     .maybeSingle() y falla.
    await admin
      .from("social_accounts")
      .update({ status: "inactive" })
      .eq("tenant_id", state.tenantId)
      .eq("channel", "messenger")
      .neq("external_account_id", String(page.id));

    // 5) Suscribir la Página a los webhooks de mensajes + comentarios (feed).
    await fetch(
      `${GRAPH}/${page.id}/subscribed_apps` +
        `?subscribed_fields=messages,messaging_postbacks,message_echoes,message_reads,feed` +
        `&access_token=${page.access_token}`,
      { method: "POST" },
    );

    return back("?fb=connected");
  } catch (err) {
    console.error("[fb-oauth] callback error", err);
    return back("?fb=error");
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
