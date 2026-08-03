// Internal-only edge function: gasto REAL de IA hacia los proveedores
// (Fal.ai + Anthropic/Claude), traído directo de sus APIs de billing. Distinto
// del panel "Uso de IA" que muestra créditos internos (tabla ai_usage_log).
//
// Restringido a admins del internal: el JWT del caller debe pasar el gate
// public._assert_internal_admin() (misma fuente de verdad que las RPC admin),
// igual que manage-stripe-coupons / impersonate-tenant. Allowlist opcional extra
// via INTERNAL_ADMIN_EMAILS.
//
// POST body: { from?: ISOdate, to?: ISOdate }  (default: últimos 30 días)
//
// Env:
//   FAL_USAGE_KEY   key de Fal con scope de plataforma (fallback: FAL_KEY)
//   ANTHROPIC_ADMIN_KEY  Admin key sk-ant-admin01-… (si falta → anthropic no configurado)
//   INTERNAL_ADMIN_EMAILS  opcional, allowlist extra (coma-separada)
//   SUPABASE_URL / SUPABASE_ANON_KEY  (auto) — para verificar al caller
//
// Fal usage: GET api.fal.ai/v1/models/usage → time_series[].results[] con
//   { endpoint_id, cost_total, currency:USD }. Devuelve USD directo.
// Anthropic cost: GET api.anthropic.com/v1/organizations/cost_report agrupado por
//   description → USD (montos en centavos como string). Requiere Admin key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FAL_KEY = Deno.env.get('FAL_USAGE_KEY') ?? Deno.env.get('FAL_KEY') ?? '';
const ANTHROPIC_ADMIN_KEY = Deno.env.get('ANTHROPIC_ADMIN_KEY') ?? '';
const ADMIN_EMAILS = (Deno.env.get('INTERNAL_ADMIN_EMAILS') ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const sumVals = (o: Record<string, number>) =>
  Object.values(o).reduce((a, b) => a + b, 0);

interface ProviderAgg {
  configured: boolean;
  byDay: Record<string, number>; // 'YYYY-MM-DD' -> USD
  byModel: Record<string, { usd: number; calls: number }>;
  error?: string;
}

// ── Fal.ai ──────────────────────────────────────────────────────────────────
async function fetchFal(from: Date, to: Date): Promise<ProviderAgg> {
  const agg: ProviderAgg = { configured: !!FAL_KEY, byDay: {}, byModel: {} };
  if (!FAL_KEY) return agg;
  try {
    let cursor: string | null = null;
    let pages = 0;
    do {
      const url = new URL('https://api.fal.ai/v1/models/usage');
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url, {
        headers: { Authorization: `Key ${FAL_KEY}` },
      });
      if (!res.ok) throw new Error(`fal ${res.status}`);
      // deno-lint-ignore no-explicit-any
      const d: any = await res.json();
      if (pages === 0) {
        console.log('fal usage sample:', JSON.stringify(d).slice(0, 500));
      }
      for (const b of d.time_series ?? []) {
        const t = new Date(b.bucket);
        if (isNaN(t.getTime()) || t < from || t >= to) continue;
        const day = String(b.bucket).slice(0, 10);
        for (const r of b.results ?? []) {
          const usd = Number(r.cost_total ?? r.cost ?? 0);
          if (!usd) continue;
          agg.byDay[day] = (agg.byDay[day] ?? 0) + usd;
          const m = r.endpoint_id ?? 'fal.ai';
          const cur = agg.byModel[m] ?? { usd: 0, calls: 0 };
          cur.usd += usd;
          cur.calls += 1;
          agg.byModel[m] = cur;
        }
      }
      cursor = d.has_more ? (d.next_cursor ?? null) : null;
      pages++;
    } while (cursor && pages < 50);
  } catch (e) {
    agg.error = String((e as Error).message ?? e).slice(0, 200);
    console.error('fetchFal error:', agg.error);
  }
  return agg;
}

// ── Anthropic / Claude ──────────────────────────────────────────────────────
async function fetchAnthropic(from: Date, to: Date): Promise<ProviderAgg> {
  const agg: ProviderAgg = {
    configured: !!ANTHROPIC_ADMIN_KEY,
    byDay: {},
    byModel: {},
  };
  if (!ANTHROPIC_ADMIN_KEY) return agg;
  try {
    let page: string | null = null;
    let iters = 0;
    do {
      const url = new URL(
        'https://api.anthropic.com/v1/organizations/cost_report'
      );
      url.searchParams.set('starting_at', from.toISOString());
      url.searchParams.set('ending_at', to.toISOString());
      url.searchParams.append('group_by[]', 'description');
      if (page) url.searchParams.set('page', page);
      const res = await fetch(url, {
        headers: {
          'x-api-key': ANTHROPIC_ADMIN_KEY,
          'anthropic-version': '2023-06-01',
        },
      });
      // deno-lint-ignore no-explicit-any
      const d: any = await res.json();
      if (!res.ok) {
        throw new Error(d?.error?.message ?? `anthropic ${res.status}`);
      }
      if (iters === 0) {
        console.log('anthropic cost sample:', JSON.stringify(d).slice(0, 800));
      }
      // Shape esperado: { data: [{ starting_at, results: [{ amount, currency,
      //   model?, description? , ... }] }], has_more, next_page }.
      // amount viene en centavos (string decimal) → USD = amount/100.
      for (const bucket of d.data ?? []) {
        const day = String(bucket.starting_at ?? '').slice(0, 10);
        for (const r of bucket.results ?? []) {
          const cents = Number(r.amount ?? r.cost ?? 0);
          if (!cents) continue;
          const usd = cents / 100;
          agg.byDay[day] = (agg.byDay[day] ?? 0) + usd;
          const m = r.model ?? r.description ?? 'claude';
          const cur = agg.byModel[m] ?? { usd: 0, calls: 0 };
          cur.usd += usd;
          agg.byModel[m] = cur;
        }
      }
      page = d.has_more ? (d.next_page ?? null) : null;
      iters++;
    } while (page && iters < 50);
  } catch (e) {
    agg.error = String((e as Error).message ?? e).slice(0, 250);
    console.error('fetchAnthropic error:', agg.error);
  }
  return agg;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    // --- Auth: admin del internal ------------------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email?.toLowerCase() ?? '';
    if (!email) return json({ error: 'No autorizado' }, 403);
    const { error: gateErr } = await supabase.rpc('_assert_internal_admin');
    if (gateErr) return json({ error: 'No autorizado' }, 403);
    if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email)) {
      return json({ error: 'No autorizado' }, 403);
    }

    // --- Rango --------------------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const to = body.to ? new Date(body.to) : new Date();
    const from = body.from
      ? new Date(body.from)
      : new Date(to.getTime() - 30 * 86_400_000);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
      return json({ error: 'Rango de fechas inválido' }, 400);
    }

    // --- Fetch en paralelo --------------------------------------------------
    const [fal, anthropic] = await Promise.all([
      fetchFal(from, to),
      fetchAnthropic(from, to),
    ]);

    // --- Merge --------------------------------------------------------------
    const days = new Set([
      ...Object.keys(fal.byDay),
      ...Object.keys(anthropic.byDay),
    ]);
    const daily = [...days]
      .sort()
      .map((day) => ({
        day,
        falUsd: round(fal.byDay[day] ?? 0),
        anthropicUsd: round(anthropic.byDay[day] ?? 0),
      }));

    const byModel = [
      ...Object.entries(fal.byModel).map(([model, v]) => ({
        provider: 'fal' as const,
        model,
        usd: round(v.usd),
        calls: v.calls,
      })),
      ...Object.entries(anthropic.byModel).map(([model, v]) => ({
        provider: 'anthropic' as const,
        model,
        usd: round(v.usd),
        calls: v.calls,
      })),
    ].sort((a, b) => b.usd - a.usd);

    const falUsd = sumVals(fal.byDay);
    const anthropicUsd = sumVals(anthropic.byDay);

    return json({
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        falUsd: round(falUsd),
        anthropicUsd: round(anthropicUsd),
        totalUsd: round(falUsd + anthropicUsd),
      },
      daily,
      byModel,
      fal: { configured: fal.configured, error: fal.error ?? null },
      anthropic: {
        configured: anthropic.configured,
        error: anthropic.error ?? null,
      },
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
