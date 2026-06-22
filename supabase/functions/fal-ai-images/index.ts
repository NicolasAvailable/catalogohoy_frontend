import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

// IA de imágenes para productos vía fal.ai. Acciones:
//   - "remove-background": quita el fondo de una imagen existente (modelo BiRefNet).
//   - "segment-points": el usuario marca con clics qué conservar/quitar (SAM-3,
//     point_prompts). Devuelve una máscara que componemos con el original
//     (alpha=máscara) → deja solo lo seleccionado sobre fondo transparente.
//   - "generate": crea una imagen desde un prompt de texto (modelo FLUX schnell).
// La función la llama el frontend con el JWT del usuario (igual que
// `send-whatsapp-test`). La FAL_KEY nunca sale del servidor. El resultado de
// fal.ai vive en una URL temporal, así que lo descargamos y lo persistimos en
// nuestro bucket `catalogohoy` para devolver una URL pública estable.

const FAL_KEY = Deno.env.get("FAL_KEY");

// Modelos fal.ai (síncronos: fal.run bloquea hasta terminar, ~2-6s).
const BIREFNET_MODEL = "fal-ai/birefnet";
const FLUX_MODEL = "fal-ai/flux/schnell";
// Segmentación interactiva por puntos/clics (SAM-2): el usuario marca el objeto.
// label 1 = conservar (foreground), 0 = quitar (background). Campo `prompts`.
// (SAM-3 es por concepto/texto, no sirve para clics → devolvía máscara vacía.)
const SAM2_MODEL = "fal-ai/sam2/image";

const STORAGE_BUCKET = "catalogohoy";

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

// Error de fal.ai con su status HTTP y el mensaje crudo, para poder mapearlo
// a un texto amigable más adelante.
class FalError extends Error {
  constructor(public status: number, public raw: string) {
    super(raw);
  }
}

// Llama a un modelo fal.ai de forma síncrona y devuelve el JSON.
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
    /* respuesta sin body JSON (p. ej. 5xx) */
  }
  if (!res.ok) {
    const detail =
      result?.detail?.[0]?.msg ?? result?.detail ?? result?.error ??
        result?.message ?? res.statusText;
    const raw = typeof detail === "string"
      ? detail
      : JSON.stringify(detail ?? "fal.ai error");
    throw new FalError(res.status, raw);
  }
  return result;
}

// Traduce el error crudo de fal.ai a un mensaje claro en español para el
// usuario final, sin filtrar detalles internos (saldo/facturación de la
// cuenta de la plataforma). El motivo real queda en los logs.
function mapFalError(err: FalError): string {
  const r = err.raw.toLowerCase();
  if (
    r.includes("exhausted balance") || r.includes("locked") ||
    r.includes("insufficient") || r.includes("balance")
  ) {
    return "El servicio de IA no está disponible por el momento. Vuelve a intentarlo más tarde.";
  }
  if (
    err.status === 401 || err.status === 403 ||
    r.includes("unauthorized") || r.includes("forbidden")
  ) {
    return "El servicio de IA no está disponible por el momento. Vuelve a intentarlo más tarde.";
  }
  if (err.status === 429 || r.includes("rate limit")) {
    return "Demasiadas solicitudes seguidas. Espera unos segundos e intenta de nuevo.";
  }
  if (r.includes("safety") || r.includes("nsfw") || r.includes("content polic")) {
    return "La imagen o el texto no cumplen con las políticas de contenido.";
  }
  if (err.status === 422 || r.includes("validation")) {
    return "No se pudo procesar la imagen. Prueba con otra imagen.";
  }
  return "No se pudo procesar la imagen con IA. Inténtalo de nuevo.";
}

// Descarga la imagen que produjo fal.ai y la sube a nuestro Storage.
// Devuelve la URL pública estable.
async function persistToStorage(
  admin: ReturnType<typeof createClient>,
  imageUrl: string,
  kind: "bg" | "gen",
): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("No se pudo descargar la imagen generada");
  const contentType = res.headers.get("content-type") ?? "image/png";
  const ext = contentType.includes("jpeg") ? "jpeg" : "png";
  const bytes = new Uint8Array(await res.arrayBuffer());

  const path = `ai/${kind}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType });
  if (error) throw new Error(error.message);

  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Sube bytes PNG ya generados (p. ej. el recorte compuesto) a Storage.
async function uploadPng(
  admin: ReturnType<typeof createClient>,
  bytes: Uint8Array,
  kind: string,
): Promise<string> {
  const path = `ai/${kind}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.png`;
  const { error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType: "image/png" });
  if (error) throw new Error(error.message);
  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Toma la imagen original y una máscara binaria (blanco = objeto) y devuelve un
// PNG con el objeto recortado sobre fondo transparente: copia el RGB original y
// usa la luminancia de la máscara como canal alpha.
async function compositeCutout(
  originalUrl: string,
  maskUrl: string,
): Promise<Uint8Array> {
  const [origBuf, maskBuf] = await Promise.all([
    fetch(originalUrl).then((r) => r.arrayBuffer()),
    fetch(maskUrl).then((r) => r.arrayBuffer()),
  ]);
  const orig = await Image.decode(new Uint8Array(origBuf));
  const mask = await Image.decode(new Uint8Array(maskBuf));
  // EVF-SAM devuelve la máscara al tamaño de entrada, pero por las dudas la
  // ajustamos para que cada píxel mapee 1:1.
  if (mask.width !== orig.width || mask.height !== orig.height) {
    mask.resize(orig.width, orig.height);
  }
  for (let y = 1; y <= orig.height; y++) {
    for (let x = 1; x <= orig.width; x++) {
      // La máscara es gris (R=G=B); tomamos el canal R como alpha.
      const alpha = (mask.getPixelAt(x, y) >>> 24) & 0xff;
      const p = orig.getPixelAt(x, y);
      const r = (p >>> 24) & 0xff;
      const g = (p >>> 16) & 0xff;
      const b = (p >>> 8) & 0xff;
      orig.setPixelAt(x, y, Image.rgbaToColor(r, g, b, alpha));
    }
  }
  return await orig.encode();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!FAL_KEY) {
    return jsonResponse({ success: false, error: "fal.ai no configurado" });
  }

  // Auth: usuario logueado (JWT). El frontend lo pasa automáticamente al invocar.
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  let body: {
    action?: string;
    imageUrl?: string;
    prompt?: string;
    points?: { x: number; y: number; label: number }[];
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  // Cliente admin (service role) para Storage y para las RPC de créditos
  // (que solo el service role puede ejecutar).
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Gate de créditos ────────────────────────────────────────────────
  // Owner = users.id mapeado desde el auth uid del JWT (nunca del body).
  const { data: ownerRow } = await admin
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const ownerId = (ownerRow as { id?: number } | null)?.id;
  if (!ownerId) {
    return jsonResponse({ success: false, error: "Usuario no encontrado" }, 403);
  }

  // Costo por acción ("borrar a mano" no pasa por aquí: es local, gratis).
  const COST: Record<string, number> = {
    "remove-background": 1,
    "segment-points": 1,
    "generate": 3,
  };
  const cost = COST[body.action ?? ""] ?? 0;
  if (cost === 0) {
    return jsonResponse({ success: false, error: "Acción no soportada" }, 400);
  }

  // Validación de input ANTES de gastar (evita gastar+devolver en requests malos).
  if (body.action === "generate") {
    if ((body.prompt ?? "").trim().length < 3) {
      return jsonResponse({ success: false, error: "Prompt demasiado corto" }, 400);
    }
  } else {
    if (!(body.imageUrl ?? "").trim()) {
      return jsonResponse({ success: false, error: "Falta la imagen" }, 400);
    }
    if (
      body.action === "segment-points" &&
      (!Array.isArray(body.points) || body.points.length === 0)
    ) {
      return jsonResponse(
        { success: false, error: "Marca al menos un punto en la imagen" },
        400,
      );
    }
  }

  // Descuento atómico (crea el pozo si no existe). spend devuelve -1 si no alcanza.
  await admin.rpc("ensure_ai_credits", { p_user_id: ownerId });
  const { data: balance, error: spendErr } = await admin.rpc(
    "spend_ai_credits",
    { p_user_id: ownerId, p_cost: cost },
  );
  if (spendErr) {
    console.error("spend_ai_credits error:", spendErr);
    return jsonResponse(
      { success: false, error: "No se pudo verificar tus créditos." },
      500,
    );
  }
  if (balance === -1) {
    return jsonResponse(
      {
        success: false,
        error: "No te quedan créditos de IA. Compra más o sube de plan.",
        code: "no_credits",
      },
      402,
    );
  }
  // ────────────────────────────────────────────────────────────────────

  try {
    if (body.action === "remove-background") {
      const imageUrl = (body.imageUrl ?? "").trim();
      if (!imageUrl) {
        return jsonResponse({ success: false, error: "Falta la imagen" }, 400);
      }
      const out = await callFal(BIREFNET_MODEL, { image_url: imageUrl });
      const resultUrl = (out as { image?: { url?: string } }).image?.url;
      if (!resultUrl) {
        throw new Error("fal.ai no devolvió imagen");
      }
      const publicUrl = await persistToStorage(admin, resultUrl, "bg");
      return jsonResponse({ success: true, url: publicUrl });
    }

    if (body.action === "segment-points") {
      const imageUrl = (body.imageUrl ?? "").trim();
      const points = Array.isArray(body.points) ? body.points : [];
      if (!imageUrl) {
        return jsonResponse({ success: false, error: "Falta la imagen" }, 400);
      }
      if (points.length === 0) {
        return jsonResponse(
          { success: false, error: "Marca al menos un punto en la imagen" },
          400,
        );
      }
      // SAM-3 rinde mejor con pocos puntos claros. Si llegan muchos (p. ej. por
      // arrastrar), nos quedamos con un máximo razonable repartido uniformemente.
      const MAX_POINTS = 24;
      const sampled = points.length > MAX_POINTS
        ? points.filter((_, i) =>
          i % Math.ceil(points.length / MAX_POINTS) === 0
        )
        : points;
      const out = await callFal(SAM2_MODEL, {
        image_url: imageUrl,
        prompts: sampled.map((p) => ({
          x: Math.round(p.x),
          y: Math.round(p.y),
          label: p.label === 0 ? 0 : 1,
        })),
        apply_mask: false,
        output_format: "png",
      });
      const maskUrl = (out as { image?: { url?: string } }).image?.url;
      if (!maskUrl) {
        throw new Error("fal.ai no devolvió máscara");
      }
      const png = await compositeCutout(imageUrl, maskUrl);
      const publicUrl = await uploadPng(admin, png, "seg");
      return jsonResponse({ success: true, url: publicUrl });
    }

    if (body.action === "generate") {
      const prompt = (body.prompt ?? "").trim();
      if (prompt.length < 3) {
        return jsonResponse({ success: false, error: "Prompt demasiado corto" }, 400);
      }
      // Si la imagen incluye texto, debe estar SIEMPRE en español (catálogos
      // hispanohablantes). Se lo indicamos explícitamente al modelo.
      const finalPrompt =
        `${prompt}. Si la imagen incluye texto o palabras, TODO el texto debe ` +
        `estar en español, correctamente escrito y sin faltas de ortografía. ` +
        `No uses inglés ni otros idiomas en el texto.`;
      const out = await callFal(FLUX_MODEL, {
        prompt: finalPrompt,
        image_size: "square_hd",
        num_images: 1,
        enable_safety_checker: true,
      });
      const resultUrl =
        (out as { images?: { url?: string }[] }).images?.[0]?.url;
      if (!resultUrl) {
        throw new Error("fal.ai no devolvió imagen");
      }
      const publicUrl = await persistToStorage(admin, resultUrl, "gen");
      return jsonResponse({ success: true, url: publicUrl });
    }

    // Inalcanzable (acción ya validada arriba), pero por si acaso devolvemos.
    await admin.rpc("refund_ai_credits", { p_user_id: ownerId, p_cost: cost });
    return jsonResponse({ success: false, error: "Acción no soportada" }, 400);
  } catch (err) {
    // La IA falló o no produjo resultado → devolver el crédito gastado.
    await admin.rpc("refund_ai_credits", { p_user_id: ownerId, p_cost: cost });
    if (err instanceof FalError) {
      // El motivo real (saldo agotado, etc.) solo en logs.
      console.error("fal-ai-images fal error:", err.status, err.raw);
      return jsonResponse({ success: false, error: mapFalError(err) });
    }
    console.error("fal-ai-images error:", err);
    return jsonResponse({
      success: false,
      error: "No se pudo procesar la imagen con IA. Inténtalo de nuevo.",
    });
  }
});
