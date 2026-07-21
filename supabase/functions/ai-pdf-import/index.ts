import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Estructura el texto de un catálogo en PDF en productos (nombre + precio).
// El frontend parsea el PDF localmente (pdf.js) y manda el texto por página;
// Claude devuelve [{page, name, price}] conservando la página para el matching
// de fotos posterior (ai-image-matcher). Cobra 1 crédito de IA por página
// analizada (gate + refund, mismo patrón que fal-ai-images/ai-image-matcher).
//
// La ANTHROPIC_API_KEY nunca sale del servidor.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const MODEL = "claude-sonnet-4-6";
const MAX_PAGES = 80;
const MAX_TEXT_PER_PAGE = 4000;
const MAX_PRODUCTS = 1000;

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

interface PdfPage {
  page: number;
  text: string;
}
interface PdfProduct {
  page: number;
  name: string;
  price: number;
}

function buildPrompt(pages: PdfPage[]): string {
  const body = pages
    .map((p) => `=== PÁGINA ${p.page} ===\n${p.text}`)
    .join("\n\n");
  return (
    `Eres un asistente que estructura catálogos de productos. El siguiente texto fue extraído de un catálogo en PDF, página por página. El texto puede venir de un diseño multi-columna: el nombre de un producto puede estar partido en varias líneas y su precio suele estar cerca (arriba o abajo).\n\n${body}\n\n` +
    `Extrae TODOS los productos a la venta. Para cada producto devuelve:\n` +
    `- page: número de página donde aparece\n` +
    `- name: nombre completo del producto tal como está impreso (une las líneas partidas; conserva presentación como "X100 TABLETAS", mayúsculas y acentos)\n` +
    `- price: precio numérico (de "Q97.00", "$1,250.50" o "97" extrae 97.00 / 1250.50 / 97)\n\n` +
    `NO incluyas: nombres de laboratorios/marcas sueltas sin precio, teléfonos, direcciones, eslóganes, títulos de sección ni texto decorativo. Si un producto aparece sin precio legible, omítelo.\n\n` +
    `Responde SOLO con un array JSON válido, sin explicación ni markdown:\n` +
    `[{"page":2,"name":"CAJA ASPIRINA X100 TABLETAS","price":76}]`
  );
}

async function callClaude(prompt: string): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
}

function parseProducts(raw: string): PdfProduct[] | null {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return null;
    return arr
      .filter(
        (p) =>
          p &&
          typeof p.name === "string" &&
          p.name.trim().length >= 2 &&
          Number.isFinite(Number(p.price)) &&
          Number(p.price) >= 0,
      )
      .slice(0, MAX_PRODUCTS)
      .map((p) => ({
        page: Math.max(1, Math.round(Number(p.page) || 1)),
        name: String(p.name).trim().slice(0, 200),
        price: Math.round(Number(p.price) * 100) / 100,
      }));
  } catch {
    return null;
  }
}

// Registra el uso en ai_usage_log (panel internal). Best-effort.
async function logAiUsage(
  admin: ReturnType<typeof createClient>,
  userId: number,
  credits: number,
  pages: number,
  products: number,
): Promise<void> {
  try {
    await admin.from("ai_usage_log").insert({
      user_id: userId,
      feature: "pdf-import",
      prompt: `${pages} páginas → ${products} productos`,
      credits,
    });
  } catch (e) {
    console.error("ai_usage_log insert failed:", e);
  }
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

  let body: { pages?: PdfPage[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  // Validación ANTES de gastar créditos.
  const pages = (body.pages ?? [])
    .filter((p) => p && typeof p.text === "string" && p.text.trim().length > 0)
    .slice(0, MAX_PAGES)
    .map((p) => ({
      page: Math.max(1, Math.round(Number(p.page) || 1)),
      text: p.text.slice(0, MAX_TEXT_PER_PAGE),
    }));
  if (!pages.length) {
    return jsonResponse(
      { success: false, error: "El PDF no tiene texto para analizar" },
      400,
    );
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Gate de créditos (1 por página) ────────────────────────────────
  const { data: ownerRow } = await admin
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const ownerId = (ownerRow as { id?: number } | null)?.id;
  if (!ownerId) {
    return jsonResponse({ success: false, error: "Usuario no encontrado" }, 403);
  }

  const cost = pages.length;
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

  // ── Claude ─────────────────────────────────────────────────────────
  try {
    const prompt = buildPrompt(pages);
    let response = await callClaude(prompt);

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      console.error("anthropic error:", response.status, raw);
      await admin.rpc("refund_ai_credits", { p_user_id: ownerId, p_cost: cost });
      return jsonResponse(
        { success: false, error: "La IA no pudo leer el PDF. Intenta de nuevo." },
        502,
      );
    }

    let result = await response.json();
    let products = parseProducts(result.content?.[0]?.text ?? "");

    if (products === null) {
      // Reintento único pidiendo JSON estricto (mismo patrón que ai-excel-mapper).
      response = await callClaude(
        prompt +
          "\n\nCRITICAL: Your previous response was not valid JSON. RESPOND WITH A VALID JSON ARRAY ONLY. No markdown fences.",
      );
      if (response.ok) {
        result = await response.json();
        products = parseProducts(result.content?.[0]?.text ?? "");
      }
    }

    if (products === null) {
      await admin.rpc("refund_ai_credits", { p_user_id: ownerId, p_cost: cost });
      return jsonResponse(
        {
          success: false,
          error: "La IA devolvió un formato inesperado. Intenta de nuevo.",
        },
        502,
      );
    }
    if (!products.length) {
      await admin.rpc("refund_ai_credits", { p_user_id: ownerId, p_cost: cost });
      return jsonResponse(
        {
          success: false,
          error:
            "La IA no encontró productos con precio en el PDF. Verifica que sea un catálogo con precios.",
        },
        422,
      );
    }

    logAiUsage(admin, ownerId, cost, pages.length, products.length);
    return jsonResponse({ success: true, products, balance });
  } catch (e) {
    console.error("ai-pdf-import error:", e);
    await admin.rpc("refund_ai_credits", { p_user_id: ownerId, p_cost: cost });
    return jsonResponse(
      { success: false, error: "La IA no pudo leer el PDF. Intenta de nuevo." },
      502,
    );
  }
});
