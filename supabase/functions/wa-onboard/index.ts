import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// wa-onboard — alta del número de WhatsApp de un COMERCIANTE (Embedded Signup).
//
// CatalogoHoy actúa como proveedor de tecnología (BSP). El frontend lanza el
// Embedded Signup de Meta y obtiene { wabaId, phoneNumberId, authCode }. Esta
// función (server-side, con el app secret) completa el alta:
//   1. Intercambia el authCode por el token de negocio DEL COMERCIANTE.
//   2. Suscribe la app del BSP a la WABA del comerciante (habilita webhooks).
//   3. (best-effort) registra el número en la Cloud API.
//   4. Lee datos del número (verified_name, quality_rating).
//   5. Guarda todo en whatsapp_accounts (service role).
//
// El token NUNCA pasa por el front. Deploy con verify_jwt=true (lo llama el
// comerciante autenticado).
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const WA_APP_ID = Deno.env.get("WA_APP_ID");
const WA_APP_SECRET = Deno.env.get("WA_APP_SECRET");
const WA_API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
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

type Payload = {
  tenantId: number;
  wabaId: string;
  phoneNumberId: string;
  authCode: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method Not Allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
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

  const { tenantId, wabaId, phoneNumberId, authCode } = body;
  if (!tenantId || !wabaId || !phoneNumberId || !authCode) {
    return jsonResponse(
      { success: false, error: "Missing tenantId, wabaId, phoneNumberId or authCode" },
      400,
    );
  }

  // 1) Verificar que el usuario autenticado es miembro del tenant.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const authUid = userData?.user?.id;
  if (!authUid) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: membership } = await admin
    .from("users_tenants")
    .select("id, users!inner(auth_user_id)")
    .eq("tenant_id", tenantId)
    .eq("users.auth_user_id", authUid)
    .maybeSingle();
  if (!membership) {
    return jsonResponse({ success: false, error: "Forbidden for this tenant" }, 403);
  }

  // 2) Intercambiar el authCode por el token de negocio del comerciante.
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

  // 3) Suscribir la app del BSP a la WABA del comerciante (habilita webhooks).
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

  // 4) Leer datos del número (best-effort).
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

  // 5) Guardar/actualizar la cuenta (upsert por phone_number_id único).
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
});
