// meta-capi — Conversions API de Meta (server-side) por tenant.
//
// La dispara el trigger de órdenes (trg_orders_meta_capi) en cada pedido PÚBLICO
// nuevo, con el mismo event_id que el pixel del navegador (order-<id>) para que
// Meta deduplique y cuente UNA sola conversión. Resuelve el pixel_id (público,
// de tenant_ecommerce_config) y el access_token (secreto, de
// meta_capi_credentials) con service role, hashea el teléfono/email como exige
// Meta y postea a graph.facebook.com/<version>/<pixel>/events.
//
// No-op silencioso si el tenant no tiene pixel, no tiene token, o la CAPI está
// deshabilitada — así el trigger puede dispararla para TODOS sin filtrar.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const META_API_VERSION = Deno.env.get("META_API_VERSION") ?? "v21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** SHA-256 hex de un valor ya normalizado (lo que exige Meta para el user_data). */
async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const normPhone = (p: string) => p.replace(/[^\d]/g, ""); // solo dígitos E.164
const normEmail = (e: string) => e.trim().toLowerCase();

interface Payload {
  tenantId: number;
  eventName: string; // 'Lead' | 'Purchase' | ...
  eventId?: string; // dedup con el pixel del navegador (p. ej. order-<id>)
  value?: number;
  currency?: string;
  numItems?: number;
  sourceUrl?: string;
  phone?: string | null;
  email?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth server-to-server: el secret compartido vive en Vault y se lee con
  // service role vía RPC (evita depender de un env secret). El trigger de
  // órdenes manda el mismo valor en el header x-webhook-secret.
  const { data: expectedSecret } = await admin.rpc("meta_capi_shared_secret");
  if (
    !expectedSecret ||
    req.headers.get("x-webhook-secret") !== expectedSecret
  ) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }
  if (!body.tenantId || !body.eventName) {
    return jsonResponse(
      { success: false, error: "Missing tenantId/eventName" },
      400,
    );
  }

  // pixel_id (público) desde la config; token (secreto) desde credentials.
  const [cfgRes, credRes] = await Promise.all([
    admin
      .from("tenant_ecommerce_config")
      .select("meta_pixel_id")
      .eq("tenant_id", body.tenantId)
      .maybeSingle(),
    admin
      .from("meta_capi_credentials")
      .select("access_token, test_event_code, enabled")
      .eq("tenant_id", body.tenantId)
      .maybeSingle(),
  ]);

  const pixelId = (cfgRes.data?.meta_pixel_id ?? "").trim();
  const cred = credRes.data as
    | { access_token: string; test_event_code: string | null; enabled: boolean }
    | null;

  if (!pixelId || !cred?.access_token || cred.enabled === false) {
    return jsonResponse({
      success: true,
      skipped: true,
      reason: "sin pixel / token / CAPI deshabilitada",
    });
  }

  // user_data hasheado (Meta exige SHA-256 de datos normalizados).
  const userData: Record<string, unknown> = {};
  if (body.phone) userData["ph"] = [await sha256(normPhone(body.phone))];
  if (body.email) userData["em"] = [await sha256(normEmail(body.email))];
  if (body.clientIp) userData["client_ip_address"] = body.clientIp;
  if (body.clientUserAgent) userData["client_user_agent"] = body.clientUserAgent;

  const customData: Record<string, unknown> = {};
  if (body.value !== undefined) customData["value"] = body.value;
  if (body.currency) customData["currency"] = body.currency;
  if (body.numItems !== undefined) customData["num_items"] = body.numItems;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: body.eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        ...(body.sourceUrl ? { event_source_url: body.sourceUrl } : {}),
        ...(body.eventId ? { event_id: body.eventId } : {}),
        user_data: userData,
        custom_data: customData,
      },
    ],
    ...(cred.test_event_code ? { test_event_code: cred.test_event_code } : {}),
    access_token: cred.access_token,
  };

  const url = `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) {
      return jsonResponse(
        {
          success: false,
          status: res.status,
          error: result?.error?.message ?? "Meta error",
          fbtrace_id: result?.error?.fbtrace_id ?? null,
        },
        502,
      );
    }
    return jsonResponse({
      success: true,
      events_received: result?.events_received ?? null,
      fbtrace_id: result?.fbtrace_id ?? null,
    });
  } catch (e) {
    return jsonResponse({ success: false, error: String(e) }, 502);
  }
});
