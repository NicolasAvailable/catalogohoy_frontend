import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// -----------------------------------------------------------------------------
// countries-proxy — thin proxy + in-memory cache for countriesnow.space
//
// Endpoints (POST body):
//   { action: "states", country: "Peru" }
//     -> { states: string[] }
//   { action: "cities", country: "Peru", state: "Lima" }
//     -> { cities: string[] }
//
// Not on the public-catalog hot path. Called only from the admin editor.
// Cache TTL: 24h. Survives warm container invocations.
// -----------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { value: unknown; expiresAt: number }>();

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function cacheSet(key: string, value: unknown) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Strip English administrative suffixes so names read cleanly in Spanish UIs.
// "Risaralda Department" -> "Risaralda", "Lima Province" -> "Lima", etc.
// Never strip if the result would be empty.
const ADMIN_SUFFIX_RE =
  /\s+(Department|Province|State|Region|District|Territory|Municipality|Prefecture|Governorate)$/i;

function cleanAdminName(name: string): string {
  const cleaned = name.replace(ADMIN_SUFFIX_RE, "").trim();
  return cleaned.length > 0 ? cleaned : name;
}

async function fetchStates(country: string): Promise<string[]> {
  const cacheKey = `states:${country}`;
  const cached = cacheGet<string[]>(cacheKey);
  if (cached) return cached;

  const res = await fetch(
    "https://countriesnow.space/api/v0.1/countries/states",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    }
  );
  if (!res.ok) throw new Error(`states upstream ${res.status}`);
  const body = (await res.json()) as {
    error: boolean;
    data?: { states?: { name: string }[] };
  };
  if (body.error) throw new Error("states upstream error");
  const states = (body.data?.states ?? [])
    .map((s) => cleanAdminName(s.name))
    .sort();
  cacheSet(cacheKey, states);
  return states;
}

async function fetchCities(country: string, state: string): Promise<string[]> {
  const cacheKey = `cities:${country}:${state}`;
  const cached = cacheGet<string[]>(cacheKey);
  if (cached) return cached;

  const res = await fetch(
    "https://countriesnow.space/api/v0.1/countries/state/cities",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, state }),
    }
  );
  if (!res.ok) throw new Error(`cities upstream ${res.status}`);
  const body = (await res.json()) as { error: boolean; data?: string[] };
  if (body.error) throw new Error("cities upstream error");
  const cities = (body.data ?? []).map((c) => cleanAdminName(c)).sort();
  cacheSet(cacheKey, cities);
  return cities;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let body: { action?: string; country?: string; state?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { action, country, state } = body;
  if (!country || typeof country !== "string") {
    return json({ error: "country_required" }, 400);
  }

  try {
    if (action === "states") {
      const states = await fetchStates(country);
      return json({ states });
    }
    if (action === "cities") {
      if (!state || typeof state !== "string") {
        return json({ error: "state_required" }, 400);
      }
      const cities = await fetchCities(country, state);
      return json({ cities });
    }
    return json({ error: "invalid_action" }, 400);
  } catch (err) {
    console.error("countries-proxy error:", err);
    return json({ error: "upstream_failed" }, 502);
  }
});
