import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// wa-templates — listar / crear plantillas (HSM) de la WABA del comerciante.
//
// El token y el waba_id viven server-side (whatsapp_accounts). Verifica que el
// usuario autenticado es miembro del tenant antes de tocar la Graph API.
// Deploy con verify_jwt=true (lo llama el agente autenticado desde el CRM).
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
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

type CreateInput = {
  name: string;
  category: string;
  language: string;
  body: string;
};
type Payload = {
  tenantId: number;
  action: "list" | "create";
  template?: CreateInput;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method Not Allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  const tenantId = Number(body.tenantId);
  const action = body.action;
  if (!tenantId || (action !== "list" && action !== "create")) {
    return jsonResponse({ success: false, error: "Missing tenantId or action" }, 400);
  }

  // Membresía: el usuario autenticado debe pertenecer al tenant.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const authUid = userData?.user?.id;
  if (!authUid) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

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

  // Cuenta de WhatsApp (waba_id + token) del comerciante.
  const { data: account } = await admin
    .from("whatsapp_accounts")
    .select("waba_id, access_token")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .not("waba_id", "is", null)
    .maybeSingle();
  const wabaId = account?.waba_id;
  const token = account?.access_token;
  if (!wabaId || !token) {
    return jsonResponse(
      { success: false, error: "El comerciante no tiene una WABA conectada" },
      409,
    );
  }

  // -------- Listar --------
  if (action === "list") {
    try {
      const res = await fetch(
        `${GRAPH}/${wabaId}/message_templates?fields=name,status,category,language,components&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const json = await res.json();
      if (!res.ok) {
        return jsonResponse({ success: false, error: json?.error ?? json }, 502);
      }
      return jsonResponse({ success: true, templates: json.data ?? [] });
    } catch (err) {
      return jsonResponse({ success: false, error: String(err) }, 500);
    }
  }

  // -------- Crear --------
  const t = body.template;
  if (!t?.name || !t?.body || !t?.category || !t?.language) {
    return jsonResponse({ success: false, error: "Faltan datos de la plantilla" }, 400);
  }
  const payload = {
    name: t.name,
    language: t.language,
    category: t.category,
    components: [{ type: "BODY", text: t.body }],
  };
  try {
    const res = await fetch(`${GRAPH}/${wabaId}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      return jsonResponse({ success: false, error: json?.error ?? json }, 502);
    }
    return jsonResponse({ success: true, result: json });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) }, 500);
  }
});
