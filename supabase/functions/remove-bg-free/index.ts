import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Quita-fondo PÚBLICO (sin login) para la herramienta gratuita de lead-gen
// en catalogohoy.com/quita-fondo-de-fotos-de-producto. Clona el core de
// `fal-ai-images` (modelo BiRefNet) pero SIN JWT ni créditos. Defensa anti-abuso:
//   • Cuota por IP (N/día) — la IP la pone la infra de Supabase (no el header
//     del cliente; verificado: X-Forwarded-For falso NO evade la cuota).
//   • Tope GLOBAL diario → red de seguridad contra agotar la FAL_KEY (que es
//     la MISMA que usa la feature paga fal-ai-images). Si se supera, se corta.
//   • Honeypot + validación de tamaño (Content-Length antes de parsear) + CORS
//     restringido a dominios propios.
// La imagen llega como data URL (base64) → el anónimo no escribe en Storage.
// El resultado se persiste en el bucket público bajo `public-tool/`.
//
// Deploy: verify_jwt=false (es público). FAL_KEY en env.

const FAL_KEY = Deno.env.get("FAL_KEY");
const BIREFNET_MODEL = "fal-ai/birefnet";
const STORAGE_BUCKET = "catalogohoy";
const TOOL = "remove-bg-free";
const DAILY_LIMIT = 3; // usos gratis por IP por día
const GLOBAL_DAILY = 500; // tope global diario (protege la FAL_KEY compartida)
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB de imagen (decodificada)
const MAX_REQUEST_BYTES = 15 * 1024 * 1024; // tope del body (base64 infla ~33%)

// CORS restringido: solo dominios propios (evita que otros sitios gasten el
// presupuesto de fal desde el navegador). curl/servidores no respetan CORS →
// para esos están la cuota por IP y el tope global.
function allowOrigin(origin: string | null): string {
  if (
    origin &&
    /^https?:\/\/(localhost(:\d+)?|(?:[a-z0-9-]+\.)?catalogohoy\.com)$/i.test(origin)
  ) {
    return origin;
  }
  return "https://catalogohoy.com";
}
function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": allowOrigin(origin),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
}
function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

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
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Método no permitido" }, 405, origin);
  }
  if (!FAL_KEY) {
    return jsonResponse({ success: false, error: "Servicio no configurado" }, 500, origin);
  }

  // Tope del body ANTES de parsear (evita DoS de memoria con payloads enormes).
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse(
      { success: false, error: "La imagen es muy pesada. Usa una de hasta 10 MB." },
      413,
      origin,
    );
  }

  let body: { image?: string; hp?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Solicitud inválida" }, 400, origin);
  }

  // Honeypot (anti-bots simples; la defensa real es cuota + tope global).
  if ((body.hp ?? "").trim().length > 0) {
    return jsonResponse({ success: false, error: "No se pudo procesar la imagen." }, 400, origin);
  }

  const image = (body.image ?? "").trim();
  if (!image || !image.startsWith("data:image/")) {
    return jsonResponse({ success: false, error: "Sube una imagen válida (JPG o PNG)." }, 400, origin);
  }
  const approxBytes = Math.floor((image.length - (image.indexOf(",") + 1)) * 0.75);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return jsonResponse(
      { success: false, error: "La imagen es muy pesada. Usa una de hasta 10 MB." },
      413,
      origin,
    );
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const ip = clientIp(req);

  // 1) Cuota por IP.
  const { data: remaining, error: quotaErr } = await admin.rpc("bump_anon_quota", {
    p_ip: ip,
    p_tool: TOOL,
    p_limit: DAILY_LIMIT,
  });
  if (quotaErr) {
    console.error("bump_anon_quota error:", quotaErr);
    return jsonResponse({ success: false, error: "No se pudo procesar. Inténtalo luego." }, 500, origin);
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
      origin,
    );
  }

  // 2) Tope GLOBAL diario (protege la FAL_KEY compartida con la feature paga).
  const { data: globalLeft } = await admin.rpc("bump_anon_quota", {
    p_ip: "__global__",
    p_tool: TOOL,
    p_limit: GLOBAL_DAILY,
  });
  if (globalLeft === -1) {
    // No penalizamos la cuota del usuario si cortamos por el tope global.
    await admin.rpc("refund_anon_quota", { p_ip: ip, p_tool: TOOL });
    console.warn("remove-bg-free: tope global diario alcanzado");
    return jsonResponse(
      {
        success: false,
        code: "busy",
        error: "La herramienta está muy demandada hoy. Vuelve a intentarlo más tarde.",
      },
      429,
      origin,
    );
  }

  try {
    const out = await callFal(BIREFNET_MODEL, { image_url: image });
    const resultUrl = (out as { image?: { url?: string } }).image?.url;
    if (!resultUrl) throw new Error("fal.ai no devolvió imagen");
    const publicUrl = await persistToStorage(admin, resultUrl);
    return jsonResponse({ success: true, url: publicUrl, remaining }, 200, origin);
  } catch (err) {
    // Falló la IA → devolvemos ambos usos (IP y global) para no penalizar.
    await admin.rpc("refund_anon_quota", { p_ip: ip, p_tool: TOOL });
    await admin.rpc("refund_anon_quota", { p_ip: "__global__", p_tool: TOOL });
    if (err instanceof FalError) {
      console.error("remove-bg-free fal error:", err.status, err.raw);
      return jsonResponse({ success: false, error: mapFalError(err) }, 200, origin);
    }
    console.error("remove-bg-free error:", err);
    return jsonResponse({
      success: false,
      error: "No se pudo quitar el fondo. Inténtalo de nuevo.",
    }, 200, origin);
  }
});
