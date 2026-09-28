// Internal-only edge function: métricas de ingresos REALES para el panel
// interno (apps/internal, Inicio). Reemplaza los KPIs que salían de
// `tenant_subscriptions` (un ledger incompleto: no registra renovaciones de
// Stripe ni la mayoría de los pagos manuales) por la verdad de:
//   • Stripe  → suscripciones activas (precio USD real, incl. grandfathered) y
//               los cobros del mes (balance_transactions liquidados en USD).
//   • Manual  → los planes que activamos nosotros a mano (tenants sin
//               stripe_subscription_id), con su monto/cyclo del ledger.
//
// Por qué no se puede calcular solo desde la DB: de los ~82 catálogos que
// pagan por Stripe, solo ~2 tienen el monto guardado en tenant_subscriptions;
// el resto vive únicamente en Stripe. Por eso el MRR/ARR/cobrado se arman
// llamando a la API de Stripe. Los planes con precio viejo (p.ej. Avanzado a
// $19.99) se respetan porque se toma el unit_amount real de la suscripción.
//
// Auth: mismo doble gate que tenant-stripe-history / manage-stripe-coupons —
// JWT del caller + public._assert_internal_admin().
//
// GET/POST (sin body). Respuesta:
// {
//   asOf: string,                 // ISO del cálculo
//   monthStart: string,           // ISO inicio de mes (UTC)
//   mrrUsd: number,               // MRR normalizado mensual (Stripe + manual)
//   arrUsd: number,               // mrrUsd * 12
//   collectedThisMonthUsd: number,// cobrado real del mes (Stripe + manual)
//   newSubsThisMonth: number,     // altas nuevas del mes (Stripe + manual)
//   stripe:  { mrrUsd, activeCount, collectedThisMonthUsd, newThisMonth, skippedNonUsd },
//   manual:  { mrrUsd, activeCount, collectedThisMonthUsd, newThisMonth, missingAmount },
// }
//
// ⚠️ Adaptive Pricing: los cobros pueden presentarse en moneda local, pero el
// balance_transaction liquida en USD (currency='usd'); ESE es "cuánto entró".
// Las suscripciones se crean con precio USD, así que el MRR es USD directo.
//
// Env: STRIPE_SECRET_KEY (requerida) · SUPABASE_URL / SUPABASE_ANON_KEY /
//      SUPABASE_SERVICE_ROLE_KEY (auto-provistas).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE = 'https://api.stripe.com/v1';
const SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

// Precios de lista (fallback solo para manuales sin monto registrado).
const LIST_PRICE_USD: Record<string, number> = {
  basico: 11.99,
  pro: 19.99,
  avanzado: 29.99,
  enterprise: 99.99,
};
const CYCLE_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

async function stripeGet(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${STRIPE}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Stripe error (${res.status})`);
  }
  return data;
}

/** Pagina un list endpoint de Stripe hasta agotar `has_more`. */
// deno-lint-ignore no-explicit-any
async function stripeList(
  path: string,
  params: Record<string, string>
): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const out: any[] = [];
  let startingAfter: string | undefined;
  // Tope de seguridad: 20 páginas * 100 = 2000 filas.
  for (let page = 0; page < 20; page++) {
    const p = { ...params, limit: '100' };
    if (startingAfter) p['starting_after'] = startingAfter;
    const data = await stripeGet(path, p);
    const rows = data.data ?? [];
    out.push(...rows);
    if (!data.has_more || rows.length === 0) break;
    startingAfter = rows[rows.length - 1].id;
  }
  return out;
}

/** unit_amount (cents) + interval → USD mensual. */
// deno-lint-ignore no-explicit-any
function monthlyUsdFromPrice(price: any): number {
  if (!price || price.currency !== 'usd' || price.unit_amount == null) return 0;
  const rec = price.recurring ?? {};
  const count = Number(rec.interval_count ?? 1) || 1;
  const amt = Number(price.unit_amount) / 100;
  switch (rec.interval) {
    case 'year':
      return amt / (12 * count);
    case 'week':
      return (amt * 52) / 12 / count;
    case 'day':
      return (amt * 365) / 12 / count;
    case 'month':
    default:
      return amt / count;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!SECRET) return json({ error: 'STRIPE_SECRET_KEY not configured' }, 500);

    // --- Auth: caller debe ser admin interno --------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: 'No autorizado' }, 403);
    const { error: gateErr } = await supabase.rpc('_assert_internal_admin');
    if (gateErr) return json({ error: 'No autorizado' }, 403);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    const monthStartUnix = Math.floor(monthStart.getTime() / 1000);

    // ======================= STRIPE ========================================
    const currentStatuses = new Set(['active', 'past_due', 'trialing']);

    const [allSubs, balanceTx] = await Promise.all([
      // status=all para poder contar activas + altas del mes por `created`.
      stripeList('/subscriptions', { status: 'all' }),
      // Cobros del mes: los balance_transactions liquidan en USD.
      stripeList('/balance_transactions', {
        'created[gte]': String(monthStartUnix),
      }),
    ]);

    let stripeMrrUsd = 0;
    let stripeSkippedNonUsd = 0;
    let stripeNewThisMonth = 0;
    const activeCustomers = new Set<string>();

    for (const s of allSubs) {
      const created = Number(s.created ?? 0);
      if (created >= monthStartUnix) stripeNewThisMonth++;
      if (!currentStatuses.has(s.status)) continue;
      const item = s.items?.data?.[0];
      const price = item?.price;
      if (price && price.currency !== 'usd') stripeSkippedNonUsd++;
      stripeMrrUsd += monthlyUsdFromPrice(price);
      const cust = typeof s.customer === 'string' ? s.customer : s.customer?.id;
      if (cust) activeCustomers.add(cust);
    }

    // Cobrado del mes (USD): charges liquidados menos reembolsos.
    let stripeCollectedUsd = 0;
    for (const bt of balanceTx) {
      if (bt.currency !== 'usd') continue;
      if (bt.type === 'charge' || bt.type === 'payment') {
        stripeCollectedUsd += Number(bt.amount) / 100;
      } else if (bt.type === 'refund' || bt.type === 'payment_refund') {
        stripeCollectedUsd += Number(bt.amount) / 100; // amount ya viene negativo
      }
    }

    // ======================= MANUAL (DB) ===================================
    // Catálogos que pagan sin Stripe (planes que activamos a mano).
    const { data: manualRows, error: manualErr } = await admin.rpc(
      'admin_manual_paying_rows'
    );
    if (manualErr) {
      // Fallback inline si el RPC no existe: consulta directa.
      return json({ error: `manual rpc: ${manualErr.message}` }, 500);
    }

    let manualMrrUsd = 0;
    let manualMissingAmount = 0;
    const manualCount = (manualRows ?? []).length;
    for (const r of manualRows ?? []) {
      const cycleMonths = CYCLE_MONTHS[r.cycle as string] ?? 1;
      let amt = r.amount_usd != null ? Number(r.amount_usd) : null;
      if (amt == null || amt <= 0) {
        manualMissingAmount++;
        amt = LIST_PRICE_USD[r.plan_id as string] ?? 0;
      }
      manualMrrUsd += amt / cycleMonths;
    }

    // Cobrado manual del mes + altas manuales del mes.
    const { data: manualMonth } = await admin.rpc('admin_manual_month_totals');
    const manualCollectedUsd = Number(manualMonth?.[0]?.collected_usd ?? 0);
    const manualNewThisMonth = Number(manualMonth?.[0]?.new_count ?? 0);

    // ======================= TOTALES =======================================
    const mrrUsd = round2(stripeMrrUsd + manualMrrUsd);
    const collectedThisMonthUsd = round2(
      stripeCollectedUsd + manualCollectedUsd
    );

    return json({
      asOf: now.toISOString(),
      monthStart: monthStart.toISOString(),
      mrrUsd,
      arrUsd: round2(mrrUsd * 12),
      collectedThisMonthUsd,
      newSubsThisMonth: stripeNewThisMonth + manualNewThisMonth,
      stripe: {
        mrrUsd: round2(stripeMrrUsd),
        activeCount: activeCustomers.size,
        collectedThisMonthUsd: round2(stripeCollectedUsd),
        newThisMonth: stripeNewThisMonth,
        skippedNonUsd: stripeSkippedNonUsd,
      },
      manual: {
        mrrUsd: round2(manualMrrUsd),
        activeCount: manualCount,
        collectedThisMonthUsd: round2(manualCollectedUsd),
        newThisMonth: manualNewThisMonth,
        missingAmount: manualMissingAmount,
      },
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
