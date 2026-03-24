import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const TARGET_SCHEMA = `TARGET FORMAT - each product must have these fields:
- name (string, required): product name
- description (string): product description, empty string if not found
- price (number, required): numeric price without currency symbols
- pricePromotional (number | null): promotional/sale price, null if not found
- stock (string | null): stock quantity as plain number string, null if not found or unlimited
- sku (string | null): SKU/product code, null if not found
- productionCost (number | null): production/manufacturing cost as number, null if not found
- categories (string): comma-separated category names, empty string if not found`;

const INSTRUCTIONS = `INSTRUCTIONS:
1. Identify which source column corresponds to each target field using fuzzy matching (e.g. "Articulo"->name, "Valor"->price, "Cantidad"->stock)
2. Normalize values: strip currency symbols ($, USD, RD$, etc.), extract numbers from strings like "50 unidades" or "$15.00", trim whitespace
3. For fields with no matching source column, use null (or empty string for name/description/categories)
4. price is REQUIRED - if you cannot determine a price for a row, set it to 0
5. Return ONLY a valid JSON array of objects with the target fields. No markdown fences, no explanation, no extra text.`;

function buildPrompt(
  headers: string[],
  rows: Record<string, unknown>[]
): string {
  return `You are a product data mapping assistant.

${TARGET_SCHEMA}

SOURCE DATA:
Column headers: ${JSON.stringify(headers)}
Rows (${rows.length} total):
${JSON.stringify(rows)}

${INSTRUCTIONS}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  // Verify JWT - reject anonymous calls
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ success: false, error: "Missing authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ success: false, error: "AI service not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { headers, rows } = await req.json() as {
      headers: string[];
      rows: Record<string, unknown>[];
    };

    if (!headers?.length || !rows?.length) {
      return new Response(JSON.stringify({ success: false, error: "Headers and rows are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (rows.length > 1000) {
      return new Response(JSON.stringify({
        success: false,
        error: "El archivo tiene demasiadas filas. El limite es 1000.",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(headers, rows);
    const maxTokens = Math.min(Math.max(4096, rows.length * 200), 64000);

    const response = await callClaude(prompt, maxTokens);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Claude API error:", errorBody);
      return new Response(JSON.stringify({ success: false, error: "Error al procesar con IA. Intenta de nuevo." }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const claudeResult = await response.json();
    const content = claudeResult.content?.[0]?.text ?? "";

    let mappedRows;
    try {
      mappedRows = JSON.parse(content);
    } catch {
      // Retry once with stricter instruction
      const retryResponse = await callClaude(
        prompt + "\n\nCRITICAL: Your previous response was not valid JSON. RESPOND WITH VALID JSON ONLY. No markdown fences.",
        maxTokens
      );
      if (!retryResponse.ok) {
        return new Response(JSON.stringify({ success: false, error: "Error al procesar con IA. Intenta de nuevo." }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
      const retryResult = await retryResponse.json();
      const retryContent = retryResult.content?.[0]?.text ?? "";
      try {
        mappedRows = JSON.parse(retryContent);
      } catch {
        return new Response(JSON.stringify({ success: false, error: "La IA no pudo procesar el archivo correctamente. Intenta con la plantilla." }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (!Array.isArray(mappedRows)) {
      return new Response(JSON.stringify({ success: false, error: "La IA devolvio un formato inesperado." }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, mappedRows }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ success: false, error: "Error interno del servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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
      model: "claude-sonnet-4-6-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
}
