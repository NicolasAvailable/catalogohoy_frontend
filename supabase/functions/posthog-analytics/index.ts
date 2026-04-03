import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const POSTHOG_HOST = "https://us.posthog.com";
const POSTHOG_KEY = Deno.env.get("POSTHOG_PERSONAL_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// ─── PostHog HogQL helper ──────────────────────────────────────
async function hogql<T = Record<string, unknown>[]>(
  query: string
): Promise<T> {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/@current/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${POSTHOG_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog query failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.results as T;
}

// ─── Query builders ────────────────────────────────────────────

function pageViewsTodayQuery(slug: string): string {
  return `
    SELECT toStartOfHour(timestamp) AS hour, count() AS total
    FROM events
    WHERE event = '$pageview'
      AND properties.tenant_slug = '${slug}'
      AND timestamp >= toStartOfDay(now())
    GROUP BY hour
    ORDER BY hour`;
}

function pageViewsMonthQuery(slug: string): string {
  return `
    SELECT toStartOfDay(timestamp) AS day, count() AS total
    FROM events
    WHERE event = '$pageview'
      AND properties.tenant_slug = '${slug}'
      AND timestamp >= dateSub(day, 30, now())
    GROUP BY day
    ORDER BY day`;
}

function pageViewsYearQuery(slug: string): string {
  return `
    SELECT toStartOfMonth(timestamp) AS month, count() AS total
    FROM events
    WHERE event = '$pageview'
      AND properties.tenant_slug = '${slug}'
      AND timestamp >= dateSub(month, 12, now())
    GROUP BY month
    ORDER BY month`;
}

function metricsQuery(slug: string): string {
  return `
    SELECT
      count() AS pageviews,
      count(DISTINCT $session_id) AS sessions,
      count(DISTINCT distinct_id) AS unique_users
    FROM events
    WHERE event = '$pageview'
      AND properties.tenant_slug = '${slug}'
      AND timestamp >= dateSub(day, 30, now())`;
}

function activeHoursQuery(slug: string): string {
  return `
    SELECT
      toDayOfWeek(timestamp) AS dow,
      toHour(timestamp) AS hour,
      count() AS pageviews,
      count(DISTINCT distinct_id) AS unique_users
    FROM events
    WHERE event = '$pageview'
      AND properties.tenant_slug = '${slug}'
      AND timestamp >= dateSub(day, 30, now())
    GROUP BY dow, hour
    ORDER BY dow, hour`;
}

function breakdownQuery(slug: string, prop: string): string {
  return `
    SELECT
      properties.${prop} AS label,
      count(DISTINCT distinct_id) AS unique_users
    FROM events
    WHERE event = '$pageview'
      AND properties.tenant_slug = '${slug}'
      AND timestamp >= dateSub(day, 30, now())
      AND properties.${prop} IS NOT NULL
      AND properties.${prop} != ''
    GROUP BY label
    ORDER BY unique_users DESC
    LIMIT 5`;
}

// ─── Data transformers ─────────────────────────────────────────

function toTimeSeries(
  rows: [string, number][]
): { x: number; y: number }[] {
  return rows.map(([ts, count]) => ({
    x: new Date(ts).getTime(),
    y: count,
  }));
}

function buildDonut(
  rows: [string, number][]
): { uniqueVisitors: number; series: number[]; labels: string[] } {
  const total = rows.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return { uniqueVisitors: 0, series: [], labels: [] };
  return {
    uniqueVisitors: total,
    series: rows.map(([, v]) => Math.round((v / total) * 100)),
    labels: rows.map(([label]) => label),
  };
}

function buildActiveHours(
  rows: [number, number, number, number][]
): { byPageViews: number[][]; byUniqueUsers: number[][] } {
  // 7x24 matrices — index 0 = Sunday (PostHog toDayOfWeek: 1=Mon..7=Sun)
  const byPageViews: number[][] = Array.from({ length: 7 }, () =>
    new Array(24).fill(0)
  );
  const byUniqueUsers: number[][] = Array.from({ length: 7 }, () =>
    new Array(24).fill(0)
  );

  for (const [dow, hour, pv, uu] of rows) {
    // PostHog toDayOfWeek: 1=Monday..7=Sunday → remap to 0=Sunday
    const dayIndex = dow === 7 ? 0 : dow;
    byPageViews[dayIndex][hour] = pv;
    byUniqueUsers[dayIndex][hour] = uu;
  }

  return { byPageViews, byUniqueUsers };
}

// ─── Main handler ──────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  // Get slug from body
  const { slug } = (await req.json()) as { slug: string };
  if (!slug) return json({ error: "slug is required" }, 400);

  if (!POSTHOG_KEY) {
    console.error("POSTHOG_PERSONAL_KEY not configured");
    return json({ error: "PostHog not configured" }, 500);
  }

  try {
    // Run all queries in parallel
    const [
      todayRows,
      monthRows,
      yearRows,
      metricsRows,
      activeHoursRows,
      browserRows,
      osRows,
      deviceRows,
      languageRows,
    ] = await Promise.all([
      hogql<[string, number][]>(pageViewsTodayQuery(slug)),
      hogql<[string, number][]>(pageViewsMonthQuery(slug)),
      hogql<[string, number][]>(pageViewsYearQuery(slug)),
      hogql<[number, number, number][]>(metricsQuery(slug)),
      hogql<[number, number, number, number][]>(activeHoursQuery(slug)),
      hogql<[string, number][]>(breakdownQuery(slug, "$browser")),
      hogql<[string, number][]>(breakdownQuery(slug, "$os")),
      hogql<[string, number][]>(breakdownQuery(slug, "$device_type")),
      hogql<[string, number][]>(breakdownQuery(slug, "$browser_language")),
    ]);

    const [pageviews, sessions, uniqueUsers] = metricsRows[0] ?? [0, 0, 0];

    const analyticsData = {
      pageViews: {
        series: {
          today: [{ name: "Visitas", data: toTimeSeries(todayRows) }],
          "one-month": [{ name: "Visitas", data: toTimeSeries(monthRows) }],
          "one-year": [{ name: "Visitas", data: toTimeSeries(yearRows) }],
        },
      },
      sessions: { amount: sessions, labels: [], series: [] },
      pageViewsMetric: { amount: pageviews, labels: [], series: [] },
      users: { amount: uniqueUsers, labels: [], series: [] },
      activeHours: buildActiveHours(activeHoursRows),
      browser: buildDonut(browserRows),
      os: buildDonut(osRows),
      device: buildDonut(deviceRows),
      language: buildDonut(languageRows),
    };

    return json(analyticsData);
  } catch (err) {
    console.error("posthog-analytics error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
