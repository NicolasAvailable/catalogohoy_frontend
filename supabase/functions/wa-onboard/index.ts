import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// wa-onboard — alta del número de WhatsApp de un COMERCIANTE (Embedded Signup).
//
// CatalogoHoy actúa como proveedor de tecnología (BSP). El SDK JS de Facebook
// exige dominios EXACTOS, así que el Embedded Signup corre en el dominio
// puente (conectar.catalogohoy.com) para funcionar desde cualquier catálogo.
//
// Acciones (POST):
//   • action=start    (JWT verificado a mano): { tenantId, returnUrl, mode }
//                     → valida membresía y devuelve la URL del puente con un
//                     `state` firmado (HMAC WA_APP_SECRET) que amarra
//                     tenant + retorno + modo (2 h — el alta primeriza es lenta).
//   • action=complete (sin JWT — la llama el puente): { state, wabaId,
//                     phoneNumberId, authCode } → verifica el state y completa
//                     el alta (token del comerciante, suscripción, upsert).
//   • legacy (sin action, JWT a mano): { tenantId, wabaId, phoneNumberId,
//                     authCode } — flujo directo original.
//
// El token del comerciante NUNCA pasa por el front. Deploy con
// verify_jwt=false (el puente no tiene sesión); el JWT se valida a mano donde
// aplica.
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const WA_APP_ID = Deno.env.get("WA_APP_ID");
const WA_APP_SECRET = Deno.env.get("WA_APP_SECRET");
const WA_API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const BRIDGE_URL = Deno.env.get("WA_BRIDGE_URL") ??
  "https://conectar.catalogohoy.com/conectar/whatsapp";
const GRAPH = `https://graph.facebook.com/${WA_API_VERSION}`;

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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// State firmado (mismo patrón que ig-oauth)
async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WA_APP_SECRET ?? "dev-secret"),
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

async function makeState(
  tenantId: number,
  mode: string,
  returnUrl: string,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 7200; // 2 h (alta primeriza lenta)
  const payload = `${tenantId}|${exp}|${mode}|${returnUrl}`;
  return `${b64urlEncode(payload)}.${await hmac(payload)}`;
}

async function parseState(
  state: string,
): Promise<{ tenantId: number; mode: string; returnUrl: string } | null> {
  const [encoded, sig] = state.split(".");
  if (!encoded || !sig) return null;
  let payload: string;
  try {
    payload = b64urlDecode(encoded);
  } catch {
    return null;
  }
  if ((await hmac(payload)) !== sig) return null;
  const [tenantId, exp, mode, ...rest] = payload.split("|");
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return { tenantId: Number(tenantId), mode, returnUrl: rest.join("|") };
}

// Autorización manual por JWT (start / legacy)
async function assertTenantMember(
  authHeader: string,
  tenantId: number,
): Promise<boolean> {
  if (!authHeader) return false;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const authUid = userData?.user?.id;
  if (!authUid) return false;

  const { data: membership } = await admin
    .from("users_tenants")
    .select("id, users!inner(auth_user_id)")
    .eq("tenant_id", tenantId)
    .eq("users.auth_user_id", authUid)
    .maybeSingle();
  return !!membership;
}

// Alta del número (flujo original: token -> suscripción -> upsert)
async function completeOnboarding(
  tenantId: number,
  wabaId: string,
  phoneNumberId: string,
  authCode: string,
): Promise<Response> {
  // 1) Intercambiar el authCode por el token de negocio del comerciante.
  let merchantToken: string;
  let tokenExpiresAt: string | null = null;
  try {
    const url =
      `${GRAPH}/oauth/access_token?client_id=${WA_APP_ID}` +
      `&client_secret=${WA_APP_SECRET}&code=${encodeURIComponent(authCode)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || !json.access_token) {
      console.error("oauth exchange failed:", res.status, JSON.stringify(json));
      return jsonResponse(
        { success: false, error: "No se pudo conectar la cuenta (token)", detail: json?.error },
        502,
      );
    }
    merchantToken = json.access_token as string;
    if (typeof json.expires_in === "number" && json.expires_in > 0) {
      tokenExpiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();
    }
  } catch (err) {
    console.error("oauth exchange error:", err);
    return jsonResponse({ success: false, error: String(err) }, 500);
  }

  // 2) Suscribir la app del BSP a la WABA del comerciante (habilita webhooks).
  try {
    const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    if (!res.ok) {
      const j = await res.json();
      console.error("subscribed_apps failed:", res.status, JSON.stringify(j));
      // No abortamos: el número se guarda igual; se puede reintentar la suscripción.
    }
  } catch (err) {
    console.error("subscribed_apps error:", err);
  }

  // 3) Leer datos del número (best-effort).
  let displayPhone = "";
  let verifiedName: string | null = null;
  let qualityRating: string | null = null;
  try {
    const res = await fetch(
      `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${merchantToken}` } },
    );
    if (res.ok) {
      const j = await res.json();
      displayPhone = j.display_phone_number ?? "";
      verifiedName = j.verified_name ?? null;
      qualityRating = j.quality_rating ?? null;
    }
  } catch (err) {
    console.error("phone number lookup error:", err);
  }

  // 4) Guardar/actualizar la cuenta (upsert por phone_number_id único).
  const { data: account, error: upsertErr } = await admin
    .from("whatsapp_accounts")
    .upsert(
      {
        tenant_id: tenantId,
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        access_token: merchantToken,
        token_expires_at: tokenExpiresAt,
        phone_number: displayPhone,
        display_name: verifiedName,
        verified_name: verifiedName,
        quality_rating: qualityRating,
        status: "active",
      },
      { onConflict: "phone_number_id" },
    )
    .select(
      "id, tenant_id, phone_number, display_name, waba_id, phone_number_id, status, created_at, updated_at",
    )
    .single();

  if (upsertErr) {
    console.error("whatsapp_accounts upsert error:", upsertErr.message);
    return jsonResponse({ success: false, error: upsertErr.message }, 500);
  }

  return jsonResponse({ success: true, account });
}

type Payload = {
  action?: "start" | "complete";
  tenantId?: number;
  wabaId?: string;
  phoneNumberId?: string;
  authCode?: string;
  returnUrl?: string;
  mode?: string;
  state?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method Not Allowed" }, 405);
  }
  if (!WA_APP_ID || !WA_APP_SECRET) {
    console.error("WA_APP_ID / WA_APP_SECRET not configured");
    return jsonResponse({ success: false, error: "WhatsApp app not configured" }, 500);
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  const authHeader = req.headers.get("Authorization") ?? "";

  // start: minta el state y devuelve la URL del puente
  if (body.action === "start") {
    const tenantId = Number(body.tenantId);
    const returnUrl = (body.returnUrl ?? "").trim();
    const mode = body.mode === "dedicated" ? "dedicated" : "coexistence";
    if (!tenantId || !/^https:\/\//.test(returnUrl)) {
      return jsonResponse({ success: false, error: "Missing tenantId/returnUrl" }, 400);
    }
    if (!(await assertTenantMember(authHeader, tenantId))) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }
    const state = await makeState(tenantId, mode, returnUrl);
    const url =
      `${BRIDGE_URL}?state=${encodeURIComponent(state)}` +
      `&mode=${mode}&return=${encodeURIComponent(returnUrl)}`;
    return jsonResponse({ success: true, url });
  }

  // complete: el puente termina el alta con el state firmado
  if (body.action === "complete") {
    const state = await parseState(body.state ?? "");
    if (!state) {
      return jsonResponse(
        {
          success: false,
          error: "Enlace vencido o inválido. Vuelve a intentarlo desde tu panel.",
        },
        403,
      );
    }
    const { wabaId, phoneNumberId, authCode } = body;
    if (!wabaId || !phoneNumberId || !authCode) {
      return jsonResponse(
        { success: false, error: "Missing wabaId, phoneNumberId or authCode" },
        400,
      );
    }
    const res = await completeOnboarding(state.tenantId, wabaId, phoneNumberId, authCode);
    // Adjuntar el returnUrl verificado para que el puente redirija.
    if (res.status === 200) {
      const json = await res.json();
      return jsonResponse({ ...json, returnUrl: state.returnUrl });
    }
    return res;
  }

  // legacy: flujo directo (JWT + membresía)
  const { tenantId, wabaId, phoneNumberId, authCode } = body;
  if (!tenantId || !wabaId || !phoneNumberId || !authCode) {
    return jsonResponse(
      { success: false, error: "Missing tenantId, wabaId, phoneNumberId or authCode" },
      400,
    );
  }
  if (!(await assertTenantMember(authHeader, Number(tenantId)))) {
    return jsonResponse({ success: false, error: "Forbidden for this tenant" }, 403);
  }
  return completeOnboarding(Number(tenantId), wabaId, phoneNumberId, authCode);
});
