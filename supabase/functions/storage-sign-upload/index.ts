import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

// =============================================================================
// storage-sign-upload — migración de Storage a S3 (fase 1).
//
// Devuelve una URL PREFIRMADA (PUT) para que el navegador suba el archivo
// DIRECTO al bucket de S3 de la organización, sin que las llaves de AWS salgan
// del servidor. Reemplaza al `client.storage.from('catalogohoy').upload()` de
// Supabase Storage. El servido se hace por CloudFront (S3_CDN_BASE_URL).
//
//   POST { kind: 'product'|'banner'|'chat'|'ai'|'invoice'|'import',
//          fileName, contentType, tenantId?, slug? }
//     -> { uploadUrl, publicUrl, key, headers }
//
// El cliente hace: fetch(uploadUrl, { method:'PUT', headers, body: blob }).
// Luego guarda `publicUrl` (CDN) en la DB, igual que hoy guarda el publicUrl
// de Supabase. Las URLs viejas de supabase.co siguen sirviéndose desde
// Supabase (compat hacia atrás); esto solo cambia a dónde van las subidas NUEVAS.
//
// Secrets requeridos (Supabase -> Edge Functions -> Secrets):
//   S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
//   S3_CDN_BASE_URL  (p.ej. https://cdn.catalogohoy.com ; si se omite, se usa
//                     la URL pública del bucket S3)
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const S3_REGION = Deno.env.get("S3_REGION") ?? "";
const S3_BUCKET = Deno.env.get("S3_BUCKET") ?? "";
const S3_ACCESS_KEY_ID = Deno.env.get("S3_ACCESS_KEY_ID") ?? "";
const S3_SECRET_ACCESS_KEY = Deno.env.get("S3_SECRET_ACCESS_KEY") ?? "";
// Base pública para leer (CloudFront). Sin barra final.
const S3_CDN_BASE_URL = (Deno.env.get("S3_CDN_BASE_URL") ?? "").replace(/\/+$/, "");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Extensión segura por content-type (no confiamos en el nombre del archivo). */
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogg",
};

function safeBaseName(name: string): string {
  return (name ?? "file")
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^\w.-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || "file";
}

/** ¿El usuario es dueño (users_tenants) o miembro de equipo aceptado del
 *  tenant? Mismo criterio que send-order-action. */
async function isTenantMember(authUserId: string, tenantId: number): Promise<boolean> {
  const { data: appUser } = await admin
    .from("users").select("id, email").eq("auth_user_id", authUserId).maybeSingle();
  if (!appUser) return false;
  const { data: link } = await admin
    .from("users_tenants").select("user_id")
    .eq("user_id", appUser.id).eq("tenant_id", tenantId).maybeSingle();
  if (link) return true;
  const { data: tm } = await admin
    .from("team_members").select("id, teams!inner(tenant_id)")
    .eq("status", "accepted")
    .or(`user_id.eq.${appUser.id},invited_email.eq.${appUser.email}`)
    .eq("teams.tenant_id", tenantId)
    .limit(1);
  return !!tm?.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  if (!S3_BUCKET || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    return json({ error: "S3 no está configurado (faltan secrets)" }, 503);
  }

  // Auth: requiere un usuario válido (mismo gate que el Storage de Supabase).
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: { kind?: string; fileName?: string; contentType?: string; tenantId?: number; slug?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const kind = String(body.kind ?? "");
  const contentType = String(body.contentType ?? "application/octet-stream").toLowerCase();
  // Sin mime conocido (xlsx, csv…) se usa la extensión del nombre original.
  const nameExt = /\.([a-z0-9]{1,8})$/i.exec(body.fileName ?? "")?.[1]?.toLowerCase();
  const ext = EXT_BY_MIME[contentType] ?? nameExt ?? "bin";
  const base = safeBaseName(body.fileName ?? "file");
  const stamp = Date.now();
  const rand = crypto.randomUUID().slice(0, 8);

  // La key se arma en el server (prefijos permitidos) — el cliente no puede
  // inyectar rutas arbitrarias en el bucket.
  let key: string;
  if (kind === "chat" || kind === "invoice") {
    const tenantId = Number(body.tenantId);
    if (!tenantId) return json({ error: `tenantId requerido para ${kind}` }, 400);
    if (!(await isTenantMember(user.id, tenantId))) return json({ error: "Forbidden" }, 403);
    key = kind === "chat"
      ? `chat-media/${tenantId}/${stamp}-${rand}.${ext}`
      : `invoices/${tenantId}/${base}-${stamp}.${ext}`;
  } else if (kind === "product" || kind === "banner") {
    key = `multimedia/${stamp}_${base}.${ext}`;
  } else if (kind === "ai") {
    // Recortes hechos a mano en el editor de IA (borrar/segmentar local).
    key = `ai/${base}_${stamp}_${rand}.${ext}`;
  } else if (kind === "import") {
    // Archivo fuente de un import (Excel/PDF/fotos) para la traza de soporte.
    const slug = String(body.slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60) || "sin-slug";
    key = `imports/${slug}/${stamp}-${base}.${ext}`;
  } else {
    return json({ error: "kind inválido" }, 400);
  }

  // Firma SigV4: URL prefirmada (query-signed) para PUT directo a S3.
  const aws = new AwsClient({
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    region: S3_REGION,
    service: "s3",
  });
  const endpoint = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}?X-Amz-Expires=300`;
  const signed = await aws.sign(endpoint, {
    method: "PUT",
    headers: { "content-type": contentType },
    aws: { signQuery: true },
  });

  const publicBase = S3_CDN_BASE_URL || `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;
  return json({
    uploadUrl: signed.url,
    publicUrl: `${publicBase}/${key}`,
    key,
    // El cliente DEBE mandar exactamente este content-type en el PUT (va firmado).
    headers: { "content-type": contentType },
  });
});
