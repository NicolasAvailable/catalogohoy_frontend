import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Identifica a qué producto corresponde cada foto (import masivo de fotos).
// El frontend manda miniaturas base64 (JPEG chico) + la lista de productos del
// tenant (id, nombre, sku); Claude (visión) devuelve el match por foto con
// confianza. 1 crédito de IA por foto (mismo gate que fal-ai-images).
//
// La ANTHROPIC_API_KEY nunca sale del servidor.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const MODEL = "claude-haiku-4-5-20251001";
const MAX_IMAGES = 20;
const MAX_PRODUCTS = 500;
// ~800KB de base64 ≈ 600KB binario por miniatura — de sobra para 384px JPEG.
const MAX_IMAGE_B64 = 800_000;

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

interface MatchImage {
  id: string;
  data: string; // base64 JPEG sin prefijo data:
}
interface MatchProduct {
  id: string;
  name: string;
  sku: string | null;
}
interface MatchResult {
  id: string;
  productId: string | null;
  confidence: number;
}

// Registra el uso en ai_usage_log (panel internal). Best-effort.
async function logAiUsage(
  admin: ReturnType<typeof createClient>,
  userId: number,
  credits: number,
  count: number,
): Promise<void> {
  try {
    await admin.from("ai_usage_log").insert({
      user_id: userId,
      feature: "image-matcher",
      prompt: `${count} fotos`,
      credits,
    });
  } catch (e) {
    console.error("ai_usage_log insert failed:", e);
  }
}

function buildContent(
  images: MatchImage[],
  products: MatchProduct[],
): unknown[] {
  const content: unknown[] = [];
  images.forEach((img, i) => {
    content.push({ type: "text", text: `FOTO ${i + 1} (id: ${img.id})` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: img.data },
    });
  });

  const list = products
    .map((p) => `- id=${p.id} | ${p.name}${p.sku ? ` | SKU: ${p.sku}` : ""}`)
    .join("\n");

  content.push({
    type: "text",
    text:
      `Eres un asistente de un catálogo de e-commerce. Estos son los productos de la tienda:\n${list}\n\n` +
      `Para CADA foto de arriba, identifica a cuál producto de la lista corresponde (por lo que se VE en la foto: tipo de artículo, color, texto en el empaque, marca, etc.).\n` +
      `Responde SOLO con un array JSON válido, sin explicación ni markdown, con un objeto por foto:\n` +
      `[{"id":"<id de la foto>","productId":"<id del producto o null>","confidence":<0 a 1>}]\n` +
      `Usa productId null cuando no estés razonablemente seguro (confidence < 0.5) o cuando la foto no corresponda a ningún producto de la lista. No inventes ids.`,
  });
  return content;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ success: false, error: "IA no configurada" }, 500);
  }

  // Auth: usuario logueado (JWT) — mismo patrón que fal-ai-images.
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

  let body: { images?: MatchImage[]; products?: MatchProduct[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  // Validación ANTES de gastar créditos.
  const images = (body.images ?? []).filter(
    (i) => i?.id && typeof i.data === "string" && i.data.length > 0,
  );
  const products = (body.products ?? [])
    .filter((p) => p?.id && p?.name)
    .slice(0, MAX_PRODUCTS)
    .map((p) => ({
      id: String(p.id),
      name: String(p.name).slice(0, 120),
      sku: p.sku ? String(p.sku).slice(0, 60) : null,
    }));
  if (!images.length || images.length > MAX_IMAGES) {
    return jsonResponse(
      { success: false, error: `Envía entre 1 y ${MAX_IMAGES} fotos` },
      400,
    );
  }
  if (images.some((i) => i.data.length > MAX_IMAGE_B64)) {
    return jsonResponse(
      { success: false, error: "Alguna miniatura es demasiado grande" },
      400,
    );
  }
  if (!products.length) {
    return jsonResponse({ success: false, error: "Sin productos" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Gate de créditos (1 por foto) ──────────────────────────────────────
  const { data: ownerRow } = await admin
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const ownerId = (ownerRow as { id?: number } | null)?.id;
  if (!ownerId) {
    return jsonResponse({ success: false, error: "Usuario no encontrado" }, 403);
  }

  const cost = images.length;
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
        code: "no_credits",
        error: "No te quedan créditos de IA. Compra más o sube de plan.",
      },
      402,
    );
  }

  // ── Claude (visión) ────────────────────────────────────────────────────
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: buildContent(images, products) }],
      }),
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      console.error("anthropic error:", response.status, raw);
      await admin.rpc("refund_ai_credits", { p_user_id: ownerId, p_cost: cost });
      return jsonResponse(
        { success: false, error: "La IA no pudo procesar las fotos. Intenta de nuevo." },
        502,
      );
    }

    const claudeResult = await response.json();
    const text: string = claudeResult.content?.[0]?.text ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();

    let parsed: MatchResult[];
    try {
      parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error("not an array");
    } catch {
      console.error("unparseable AI response:", cleaned.slice(0, 400));
      await admin.rpc("refund_ai_credits", { p_user_id: ownerId, p_cost: cost });
      return jsonResponse(
        { success: false, error: "La IA devolvió un formato inesperado. Intenta de nuevo." },
        502,
      );
    }

    // Sanitizar: solo ids de fotos enviadas y productIds reales de la lista.
    const validProductIds = new Set(products.map((p) => p.id));
    const validImageIds = new Set(images.map((i) => i.id));
    const matches: MatchResult[] = parsed
      .filter((m) => m && validImageIds.has(String(m.id)))
      .map((m) => ({
        id: String(m.id),
        productId:
          m.productId != null && validProductIds.has(String(m.productId))
            ? String(m.productId)
            : null,
        confidence: Math.max(0, Math.min(1, Number(m.confidence) || 0)),
      }));

    logAiUsage(admin, ownerId, cost, images.length);
    return jsonResponse({ success: true, matches, balance });
  } catch (e) {
    console.error("ai-image-matcher error:", e);
    await admin.rpc("refund_ai_credits", { p_user_id: ownerId, p_cost: cost });
    return jsonResponse(
      { success: false, error: "La IA no pudo procesar las fotos. Intenta de nuevo." },
      502,
    );
  }
});
