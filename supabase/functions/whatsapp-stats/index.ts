import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Panel "Notificaciones WhatsApp" del interno. Gated: solo admin interno
// (_assert_internal_admin). Devuelve el costo/volumen REAL por categoría que
// reporta Meta para la WABA de plataforma (pricing_analytics; fallback
// conversation_analytics para cuentas aún en pricing por conversación),
// agregado por mes UTC. Si el token no tiene permiso de analytics, devuelve
// `metaError` y el front cae al costo estimado por tarifas.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// WABA de plataforma (portfolio CatalogoHoy LLC) — ver .claude/docs/integrations.md.
const WABA_ID = Deno.env.get("WHATSAPP_WABA_ID") ?? "1038950559044032";
const API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

type MonthBucket = {
  month: string; // YYYY-MM (UTC)
  categories: Record<string, { volume: number; cost: number }>;
  volume: number;
  cost: number;
};

type RawPoint = {
  start: number;
  volume: number;
  cost: number;
  category: string;
};

function bucketByMonth(points: RawPoint[]): MonthBucket[] {
  const byMonth = new Map<string, MonthBucket>();
  for (const p of points) {
    const d = new Date(p.start * 1000);
    const month = `${d.getUTCFullYear()}-${
      String(d.getUTCMonth() + 1).padStart(2, "0")
    }`;
    const bucket = byMonth.get(month) ??
      { month, categories: {}, volume: 0, cost: 0 };
    const cat = bucket.categories[p.category] ?? { volume: 0, cost: 0 };
    cat.volume += p.volume;
    cat.cost += p.cost;
    bucket.categories[p.category] = cat;
    bucket.volume += p.volume;
    bucket.cost += p.cost;
    byMonth.set(month, bucket);
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
}

async function graphAnalytics(
  token: string,
  fields: string,
): Promise<{ body: Record<string, unknown> | null; error: string | null }> {
  const res = await fetch(
    `${GRAPH}/${WABA_ID}?fields=${encodeURIComponent(fields)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { message?: string } } | null)?.error
      ?.message ?? `Graph API ${res.status}`;
    return { body: null, error };
  }
  return { body, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    // --- Gate: solo admin interno ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { error: adminErr } = await userClient.rpc("_assert_internal_admin");
    if (adminErr) return json({ error: "Unauthorized" }, 403);

    const token = Deno.env.get("WHATSAPP_TOKEN");
    if (!token) {
      return json({ months: [], source: null, metaError: "WHATSAPP_TOKEN no configurado" });
    }

    // Ventana: mes actual + 2 anteriores, en granularidad diaria (los buckets
    // diarios hacen robusto el corte por mes; MONTHLY depende del huso de la WABA).
    const now = new Date();
    const start = Math.floor(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1) / 1000,
    );
    const end = Math.floor(now.getTime() / 1000);

    // Per-message pricing (jul-2025 en adelante).
    const pricing = await graphAnalytics(
      token,
      `pricing_analytics.start(${start}).end(${end}).granularity(DAILY)` +
        `.dimensions(["PRICING_CATEGORY","PRICING_TYPE"])`,
    );
    if (pricing.body) {
      const data = (pricing.body as {
        pricing_analytics?: { data?: { data_points?: Array<Record<string, unknown>> }[] };
      }).pricing_analytics?.data ?? [];
      const points: RawPoint[] = data
        .flatMap((d) => d.data_points ?? [])
        .map((p) => ({
          start: Number(p.start) || 0,
          volume: Number(p.volume) || 0,
          cost: Number(p.cost) || 0,
          category: String(p.pricing_category ?? "UNKNOWN"),
        }));
      return json({
        wabaId: WABA_ID,
        source: "pricing",
        months: bucketByMonth(points),
        metaError: null,
      });
    }

    // Fallback: analytics por conversación (esquema viejo).
    const conv = await graphAnalytics(
      token,
      `conversation_analytics.start(${start}).end(${end}).granularity(DAILY)` +
        `.dimensions(["CONVERSATION_CATEGORY"])`,
    );
    if (conv.body) {
      const data = (conv.body as {
        conversation_analytics?: { data?: { data_points?: Array<Record<string, unknown>> }[] };
      }).conversation_analytics?.data ?? [];
      const points: RawPoint[] = data
        .flatMap((d) => d.data_points ?? [])
        .map((p) => ({
          start: Number(p.start) || 0,
          volume: Number(p.conversation) || 0,
          cost: Number(p.cost) || 0,
          category: String(p.conversation_category ?? "UNKNOWN"),
        }));
      return json({
        wabaId: WABA_ID,
        source: "conversation",
        months: bucketByMonth(points),
        metaError: null,
      });
    }

    return json({
      wabaId: WABA_ID,
      source: null,
      months: [],
      metaError: pricing.error ?? conv.error ?? "Sin datos de Meta",
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
