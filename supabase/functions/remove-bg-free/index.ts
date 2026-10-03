import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Quita-fondo PÚBLICO (sin login) para la herramienta gratuita de lead-gen
// en catalogohoy.com/quita-fondo-de-fotos-de-producto. Clona el core de
// `fal-ai-images` (modelo BiRefNet) pero SIN JWT ni créditos: en su lugar
// limita por IP (N/día) y usa un honeypot anti-bots. La imagen llega como
// data URL (base64) para que el anónimo no tenga que escribir en Storage;
// fal.ai acepta data URIs en `image_url`. El resultado se persiste en el
// bucket público bajo el prefijo `public-tool/` y se devuelve su URL estable
// (CORS amigable para la descarga).
//
// Deploy: verify_jwt=false (es público). FAL_KEY en env (nunca sale del server).

const FAL_KEY = Deno.env.get("FAL_KEY");
const BIREFNET_MODEL = "fal-ai/birefnet";
const STORAGE_BUCKET = "catalogohoy";
const TOOL = "remove-bg-free";
const DAILY_LIMIT = 3; // usos gratis por IP por día (sin cuenta)
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

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

// IP del cliente (Supabase pone x-forwarded-for; tomamos la primera).
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

class FalError extends Error {
  constructor(public status: number, public raw: string) {
    super(raw);
  }
}

async function callFal(
  model: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  // deno-lint-ignore no-explicit-any
  let result: any = {};
  try {
    result = await res.json();
  } catch {
    /* sin body JSON */
  }
  if (!res.ok) {
    const detail = result?.detail?.[0]?.msg ?? result?.detail ?? result?.error ??
      result?.message ?? res.statusText;
    const raw = typeof detail === "string"
      ? detail
      : JSON.stringify(detail ?? "fal.ai error");
    throw new FalError(res.status, raw);
  }
  return result;
}

function mapFalError(err: FalError): string {
  const r = err.raw.toLowerCase();
  if (
    r.includes("exhausted balance") || r.includes("locked") ||
    r.includes("insufficient") || r.includes("balance") ||
    err.status === 401 || err.status === 403
  ) {
    return "El servicio no está disponible por el momento. Vuelve a intentarlo más tarde.";
  }
  if (err.status === 429 || r.includes("rate limit")) {
    return "Demasiadas solicitudes seguidas. Espera unos segundos e intenta de nuevo.";
  }
  if (err.status === 422 || r.includes("validation")) {
    return "No se pudo procesar la imagen. Prueba con otra foto.";
  }
  return "No se pudo quitar el fondo. Inténtalo de nuevo con otra foto.";
}

// Descarga el resultado de fal.ai y lo sube a nuestro bucket público bajo
// `public-tool/`, devolviendo una URL estable con CORS amigable.
async function persistToStorage(
  admin: ReturnType<typeof createClient>,
  imageUrl: string,
): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("No se pudo descargar la imagen generada");
  const contentType = res.headers.get("content-type") ?? "image/png";
  const bytes = new Uint8Array(await res.arrayBuffer());
  const path = `public-tool/bg_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.png`;
  const { error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType });
  if (error) throw new Error(error.message);
  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Método no permitido" }, 405);
  }
  if (!FAL_KEY) {
    return jsonResponse({ success: false, error: "Servicio no configurado" }, 500);
  }

  let body: { image?: string; hp?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Solicitud inválida" }, 400);
  }

  // Honeypot: un bot rellena el campo oculto; respondemos como si nada pero no procesamos.
  if ((body.hp ?? "").trim().length > 0) {
    return jsonResponse({ success: false, error: "No se pudo procesar la imagen." }, 400);
  }

  const image = (body.image ?? "").trim();
  if (!image || !image.startsWith("data:image/")) {
    return jsonResponse({ success: false, error: "Sube una imagen válida (JPG o PNG)." }, 400);
  }
  // Tamaño aprox desde el largo del base64 (3/4 del largo).
  const approxBytes = Math.floor((image.length - (image.indexOf(",") + 1)) * 0.75);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return jsonResponse(
      { success: false, error: "La imagen es muy pesada. Usa uno de hasta 10 MB." },
      413,
    );
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Cuota por IP (antes de gastar en fal.ai). -1 = excedió el límite del día.
  const ip = clientIp(req);
  const { data: remaining, error: quotaErr } = await admin.rpc("bump_anon_quota", {
    p_ip: ip,
    p_tool: TOOL,
    p_limit: DAILY_LIMIT,
  });
  if (quotaErr) {
    console.error("bump_anon_quota error:", quotaErr);
    return jsonResponse({ success: false, error: "No se pudo procesar. Inténtalo luego." }, 500);
  }
  if (remaining === -1) {
    return jsonResponse(
      {
        success: false,
        code: "quota",
        error:
          "Llegaste al límite gratis del día. Crea tu cuenta gratis en CatalogoHoy para seguir quitando fondos sin límite.",
      },
      429,
    );
  }

  try {
    const out = await callFal(BIREFNET_MODEL, { image_url: image });
    const resultUrl = (out as { image?: { url?: string } }).image?.url;
    if (!resultUrl) throw new Error("fal.ai no devolvió imagen");
    const publicUrl = await persistToStorage(admin, resultUrl);
    return jsonResponse({ success: true, url: publicUrl, remaining });
  } catch (err) {
    // Falló la IA → devolvemos el uso para no penalizar al usuario.
    await admin.rpc("refund_anon_quota", { p_ip: ip, p_tool: TOOL });
    if (err instanceof FalError) {
      console.error("remove-bg-free fal error:", err.status, err.raw);
      return jsonResponse({ success: false, error: mapFalError(err) });
    }
    console.error("remove-bg-free error:", err);
    return jsonResponse({
      success: false,
      error: "No se pudo quitar el fondo. Inténtalo de nuevo.",
    });
  }
});
