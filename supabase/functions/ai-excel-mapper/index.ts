import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const MAPPING_PROMPT = `You are a product data mapping assistant. Analyze the source columns and sample data, then return a JSON mapping object.

TARGET FIELDS:
- name (string, required): product name
- description (string): product description
- price (number, required): numeric price
- pricePromotional (number | null): promotional/sale price
- stock (string | null): stock quantity
- sku (string | null): SKU/product code
- productionCost (number | null): production cost
- categories (string): comma-separated category names

For each target field, tell me:
1. Which source column maps to it (or null if none)
2. A normalization rule: "none", "number" (strip currency/text, extract number), "string" (trim), or "null" (always null)

RESPOND WITH ONLY a JSON object in this exact format, no explanation:
{
  "name": { "sourceColumn": "Articulo", "rule": "string" },
  "description": { "sourceColumn": "Detalle", "rule": "string" },
  "price": { "sourceColumn": "Valor", "rule": "number" },
  "pricePromotional": { "sourceColumn": null, "rule": "null" },
  "stock": { "sourceColumn": "Cantidad", "rule": "number" },
  "sku": { "sourceColumn": "Codigo", "rule": "string" },
  "productionCost": { "sourceColumn": null, "rule": "null" },
  "categories": { "sourceColumn": "Categoria", "rule": "string" }
}`;

interface ColumnMapping {
  sourceColumn: string | null;
  rule: "none" | "number" | "string" | "null";
}

interface MappingPlan {
  name: ColumnMapping;
  description: ColumnMapping;
  price: ColumnMapping;
  pricePromotional: ColumnMapping;
  stock: ColumnMapping;
  sku: ColumnMapping;
  productionCost: ColumnMapping;
  categories: ColumnMapping;
}

interface ProductExcelRow {
  name: string;
  description: string;
  price: number;
  pricePromotional: number | null;
  stock: string | null;
  sku: string | null;
  productionCost: number | null;
  categories: string;
}

function buildMappingPrompt(headers: string[], sampleRows: Record<string, unknown>[]): string {
  return `${MAPPING_PROMPT}

SOURCE DATA:
Column headers: ${JSON.stringify(headers)}
Sample rows (${sampleRows.length} of many):
${JSON.stringify(sampleRows, null, 2)}`;
}

function normalizeValue(value: unknown, rule: string): string | number | null {
  if (value === null || value === undefined || value === "") return null;

  const str = String(value).trim();
  if (!str) return null;

  switch (rule) {
    case "number": {
      const cleaned = str.replace(/[^0-9.,\-]/g, "").replace(/,/g, ".");
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    case "string":
      return str;
    case "null":
      return null;
    case "none":
    default:
      return str;
  }
}

function applyMapping(row: Record<string, unknown>, mapping: MappingPlan): ProductExcelRow {
  const getValue = (field: ColumnMapping): unknown => {
    if (!field.sourceColumn) return null;
    return row[field.sourceColumn] ?? null;
  };

  const name = normalizeValue(getValue(mapping.name), mapping.name.rule);
  const price = normalizeValue(getValue(mapping.price), mapping.price.rule);

  return {
    name: typeof name === "string" ? name : "",
    description: (normalizeValue(getValue(mapping.description), mapping.description.rule) as string) ?? "",
    price: typeof price === "number" ? price : 0,
    pricePromotional: normalizeValue(getValue(mapping.pricePromotional), mapping.pricePromotional.rule) as number | null,
    stock: (() => {
      const v = normalizeValue(getValue(mapping.stock), mapping.stock.rule);
      return v !== null ? String(v) : null;
    })(),
    sku: normalizeValue(getValue(mapping.sku), mapping.sku.rule) as string | null,
    productionCost: normalizeValue(getValue(mapping.productionCost), mapping.productionCost.rule) as number | null,
    categories: (normalizeValue(getValue(mapping.categories), mapping.categories.rule) as string) ?? "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse({ success: false, error: "Missing authorization header" }, 401);
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ success: false, error: "AI service not configured" }, 500);
  }

  try {
    const { headers, rows } = await req.json() as {
      headers: string[];
      rows: Record<string, unknown>[];
    };

    if (!headers?.length || !rows?.length) {
      return jsonResponse({ success: false, error: "Headers and rows are required" }, 400);
    }

    if (rows.length > 5000) {
      return jsonResponse({ success: false, error: "El archivo tiene demasiadas filas. El limite es 5000." }, 400);
    }

    // Step 1: Send only 5 sample rows to Claude for mapping analysis
    const sampleRows = rows.slice(0, 5);
    const prompt = buildMappingPrompt(headers, sampleRows);

    console.log("Calling Claude with", headers.length, "headers and", sampleRows.length, "sample rows");

    const response = await callClaude(prompt, 2048);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Claude API error:", errorBody);
      return jsonResponse({ success: false, error: "Error al procesar con IA. Intenta de nuevo." }, 502);
    }

    const claudeResult = await response.json();
    const content = claudeResult.content?.[0]?.text ?? "";

    console.log("Claude raw response:", content.substring(0, 500));

    let mapping: MappingPlan;
    try {
      mapping = JSON.parse(content);
    } catch {
      // Retry once with stricter instruction
      console.log("JSON parse failed, retrying...");
      const retryResponse = await callClaude(
        prompt + "\n\nCRITICAL: Your previous response was not valid JSON. RESPOND WITH VALID JSON ONLY. No markdown fences.",
        2048
      );
      if (!retryResponse.ok) {
        return jsonResponse({ success: false, error: "Error al procesar con IA. Intenta de nuevo." }, 502);
      }
      const retryResult = await retryResponse.json();
      const retryContent = retryResult.content?.[0]?.text ?? "";
      try {
        mapping = JSON.parse(retryContent);
      } catch {
        return jsonResponse({ success: false, error: "La IA no pudo procesar el archivo correctamente. Intenta con la plantilla." }, 422);
      }
    }

    console.log("Mapping plan:", JSON.stringify(mapping));

    // Validate mapping has required fields
    if (!mapping.name || !mapping.price) {
      return jsonResponse({ success: false, error: "La IA no pudo identificar las columnas de nombre y precio." }, 422);
    }

    // Step 2: Apply mapping to ALL rows deterministically (no AI needed)
    const mappedRows = rows.map((row) => applyMapping(row, mapping));

    console.log("Mapped", mappedRows.length, "rows. First row:", JSON.stringify(mappedRows[0]));

    return jsonResponse({ success: true, mappedRows });
  } catch (err) {
    console.error("Edge function error:", err);
    return jsonResponse({ success: false, error: "Error interno del servidor" }, 500);
  }
});

async function callClaude(prompt: string, maxTokens: number): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
}
