import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Envío de notificaciones push a las apps móviles (Capacitor) vía FCM HTTP v1.
// FCM cubre Android (nativo) e iOS (a través de APNs configurado en Firebase).
// La invocan server-to-server (trigger/edge fn de órdenes, webhooks de CRM),
// por eso autentica con x-webhook-secret en vez del JWT de usuario.
//
// Secrets requeridos:
//   PUSH_WEBHOOK_SECRET        — secreto compartido para invocarla.
//   FCM_SERVICE_ACCOUNT        — JSON de la service account de Firebase
//                                (project_id, client_email, private_key).
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — para leer/limpiar tokens.

const PUSH_WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET");
const FCM_SERVICE_ACCOUNT = Deno.env.get("FCM_SERVICE_ACCOUNT");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

type Payload = {
  authUserIds?: string[]; // destinatarios directos (uuid de auth.users)
  tenantId?: number; // o resolvemos el equipo del tenant
  title: string;
  body: string;
  route?: string; // deep-link al tocar (p.ej. /admin/orders?order=ID)
  data?: Record<string, string>;
};

// ── FCM auth: service account JWT → OAuth access token ──────────────────────

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

let cachedToken: { value: string; exp: number } | null = null;

async function getAccessToken(sa: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = new TextEncoder();
  const unsigned =
    base64UrlEncode(enc.encode(JSON.stringify(header))) +
    "." +
    base64UrlEncode(enc.encode(JSON.stringify(claim)));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned)),
  );
  const jwt = unsigned + "." + base64UrlEncode(sig);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`oauth: ${JSON.stringify(json)}`);
  cachedToken = { value: json.access_token, exp: now + 3600 };
  return json.access_token;
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (
    !PUSH_WEBHOOK_SECRET ||
    req.headers.get("x-webhook-secret") !== PUSH_WEBHOOK_SECRET
  ) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  if (!FCM_SERVICE_ACCOUNT) {
    return jsonResponse({ error: "missing_fcm_service_account" }, 500);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  if (!payload.title || !payload.body) {
    return jsonResponse({ error: "title_and_body_required" }, 400);
  }

  const sa = JSON.parse(FCM_SERVICE_ACCOUNT) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1) Resolver los auth_user_id destinatarios.
  let authUserIds = payload.authUserIds ?? [];
  if (authUserIds.length === 0 && payload.tenantId != null) {
    const { data: links } = await supabase
      .from("users_tenants")
      .select("user_id")
      .eq("tenant_id", payload.tenantId);
    const userIds = (links ?? []).map((l) => l.user_id);
    if (userIds.length) {
      const { data: users } = await supabase
        .from("users")
        .select("auth_user_id")
        .in("id", userIds);
      authUserIds = (users ?? [])
        .map((u) => u.auth_user_id)
        .filter((v): v is string => !!v);
    }
  }
  if (authUserIds.length === 0) {
    return jsonResponse({ sent: 0, reason: "no_recipients" });
  }

  // 2) Cargar los tokens de esos usuarios.
  const { data: rows } = await supabase
    .from("device_push_tokens")
    .select("token")
    .in("auth_user_id", authUserIds);
  const tokens = (rows ?? []).map((r) => r.token as string);
  if (tokens.length === 0) {
    return jsonResponse({ sent: 0, reason: "no_tokens" });
  }

  // 3) Enviar por FCM HTTP v1 (un request por token).
  const accessToken = await getAccessToken(sa);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const data: Record<string, string> = { ...(payload.data ?? {}) };
  if (payload.route) data.route = payload.route;

  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    tokens.map(async (token) => {
      const message = {
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          data,
          android: { priority: "high" },
          apns: {
            payload: { aps: { sound: "default", "content-available": 1 } },
          },
        },
      };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
      if (res.ok) {
        sent++;
        return;
      }
      const err = await res.json().catch(() => ({}));
      const status = err?.error?.details?.[0]?.errorCode ?? err?.error?.status;
      // Token muerto → limpiarlo para no reintentar siempre.
      if (
        status === "UNREGISTERED" ||
        status === "INVALID_ARGUMENT" ||
        res.status === 404
      ) {
        stale.push(token);
      }
    }),
  );

  if (stale.length) {
    await supabase.from("device_push_tokens").delete().in("token", stale);
  }

  return jsonResponse({ sent, total: tokens.length, cleaned: stale.length });
});
