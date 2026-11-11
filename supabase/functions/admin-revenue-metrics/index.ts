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
//   topPayers: [{ tenantId, name, slug, planId, source, mrrUsd }],  // top 10 por MRR real
//   demoExcluded: number,         // catálogos marcados demo (tenants.is_demo) que se excluyen
// }
//
// Cuentas demo (2026-11-10): los catálogos con `tenants.is_demo = true` no
// cuentan en NADA (MRR, cobrado, activos, top). En Stripe se excluyen por su
// subscription/customer id; los manuales ya vienen filtrados por el RPC.
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
  avanzado: 34.99,
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

    // ======================= DEMO + MAPEO STRIPE → CATÁLOGO =================
    // Si la columna is_demo aún no existe (migración sin aplicar) seguimos sin demo.
    const demoSubs = new Set<string>();
    const demoCustomers = new Set<string>();
    let demoExcluded = 0;
    {
      const { data: demoRows, error: demoErr } = await admin
        .from('tenants')
        .select('stripe_subscription_id, stripe_customer_id')
        .eq('is_demo', true);
      if (!demoErr) {
        demoExcluded = (demoRows ?? []).length;
        for (const r of demoRows ?? []) {
          if (r.stripe_subscription_id) demoSubs.add(r.stripe_subscription_id);
          if (r.stripe_customer_id) demoCustomers.add(r.stripe_customer_id);
        }
      }
    }

    interface TenantRef {
      id: number;
      name: string | null;
      slug: string | null;
      plan_id: string | null;
      iap_store: string | null;
      stripe_subscription_id: string | null;
      stripe_customer_id: string | null;
    }
    const { data: stripeTenants } = await admin
      .from('tenants')
      .select(
        'id, name, slug, plan_id, iap_store, stripe_subscription_id, stripe_customer_id'
      )
      .or('stripe_subscription_id.not.is.null,stripe_customer_id.not.is.null');
    const tenantBySub = new Map<string, TenantRef>();
    const tenantByCustomer = new Map<string, TenantRef>();
    for (const t of (stripeTenants ?? []) as TenantRef[]) {
      if (t.stripe_subscription_id) tenantBySub.set(t.stripe_subscription_id, t);
      if (t.stripe_customer_id && !tenantByCustomer.has(t.stripe_customer_id)) {
        tenantByCustomer.set(t.stripe_customer_id, t);
      }
    }

    // Top clientes por MRR real (Stripe + manual), agrupado por catálogo.
    interface Payer {
      tenantId: number | null;
      name: string;
      slug: string | null;
      planId: string | null;
      source: 'stripe' | 'manual' | 'app_store' | 'play_store';
      mrrUsd: number;
    }
    const payers = new Map<string, Payer>();
    const addPayer = (key: string, base: Omit<Payer, 'mrrUsd'>, mrr: number) => {
      const cur = payers.get(key);
      if (cur) cur.mrrUsd += mrr;
      else payers.set(key, { ...base, mrrUsd: mrr });
    };

    // ======================= STRIPE ========================================
    const currentStatuses = new Set(['active', 'past_due', 'trialing']);

    const [allSubs, balanceTx] = await Promise.all([
      // status=all para poder contar activas + altas del mes por `created`.
      // expand customer → nombre/email para el top cuando no hay catálogo ligado.
      stripeList('/subscriptions', { status: 'all', 'expand[]': 'data.customer' }),
      // Cobros del mes: los balance_transactions liquidan en USD. expand source
      // → customer del cargo, para poder excluir las cuentas demo.
      stripeList('/balance_transactions', {
        'created[gte]': String(monthStartUnix),
        'expand[]': 'data.source',
      }),
    ]);

    let stripeMrrUsd = 0;
    let stripeSkippedNonUsd = 0;
    let stripeNewThisMonth = 0;
    const activeCustomers = new Set<string>();

    for (const s of allSubs) {
      const cust: string | undefined =
        typeof s.customer === 'string' ? s.customer : s.customer?.id;
      if (demoSubs.has(s.id) || (cust && demoCustomers.has(cust))) continue;
      const created = Number(s.created ?? 0);
      if (created >= monthStartUnix) stripeNewThisMonth++;
      if (!currentStatuses.has(s.status)) continue;
      const item = s.items?.data?.[0];
      const price = item?.price;
      if (price && price.currency !== 'usd') stripeSkippedNonUsd++;
      const subMrr = monthlyUsdFromPrice(price);
      stripeMrrUsd += subMrr;
      if (cust) activeCustomers.add(cust);

      const t = tenantBySub.get(s.id) ?? (cust ? tenantByCustomer.get(cust) : undefined);
      if (t) {
        addPayer(
          `t:${t.id}`,
          { tenantId: t.id, name: t.name ?? t.slug ?? `#${t.id}`, slug: t.slug, planId: t.plan_id, source: 'stripe' },
          subMrr
        );
      } else {
        const custObj = typeof s.customer === 'object' ? s.customer : null;
        addPayer(
          `c:${cust ?? s.id}`,
          {
            tenantId: null,
            name: custObj?.name || custObj?.email || cust || s.id,
            slug: null,
            planId: null,
            source: 'stripe',
          },
          subMrr
        );
      }
    }

    // Cobrado del mes (USD): charges liquidados menos reembolsos.
    // Fees: comisión de Stripe por transacción (bt.fee, en centavos, positivo).
    let stripeCollectedUsd = 0;
    let stripeFeesUsd = 0;
    for (const bt of balanceTx) {
      if (bt.currency !== 'usd') continue;
      const src = bt.source;
      const btCust: string | undefined =
        src && typeof src === 'object'
          ? typeof src.customer === 'string'
            ? src.customer
            : src.customer?.id
          : undefined;
      if (btCust && demoCustomers.has(btCust)) continue;
      if (bt.type === 'charge' || bt.type === 'payment') {
        stripeCollectedUsd += Number(bt.amount) / 100;
      } else if (bt.type === 'refund' || bt.type === 'payment_refund') {
        stripeCollectedUsd += Number(bt.amount) / 100; // amount ya viene negativo
      }
      stripeFeesUsd += Number(bt.fee ?? 0) / 100;
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

    const manualIds = (manualRows ?? []).map((r: { tenant_id: number }) => r.tenant_id);
    const manualTenants = new Map<number, TenantRef>();
    if (manualIds.length) {
      const { data: mt } = await admin
        .from('tenants')
        .select('id, name, slug, plan_id, iap_store, stripe_subscription_id, stripe_customer_id')
        .in('id', manualIds);
      for (const t of (mt ?? []) as TenantRef[]) manualTenants.set(t.id, t);
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
      const rowMrr = amt / cycleMonths;
      manualMrrUsd += rowMrr;
      const t = manualTenants.get(Number(r.tenant_id));
      const source: Payer['source'] =
        t?.iap_store === 'app_store'
          ? 'app_store'
          : t?.iap_store === 'play_store'
            ? 'play_store'
            : 'manual';
      addPayer(
        `t:${r.tenant_id}`,
        {
          tenantId: Number(r.tenant_id),
          name: t?.name ?? t?.slug ?? `#${r.tenant_id}`,
          slug: t?.slug ?? null,
          planId: r.plan_id ?? t?.plan_id ?? null,
          source,
        },
        rowMrr
      );
    }

    const topPayers = [...payers.values()]
      .map((p) => ({ ...p, mrrUsd: round2(p.mrrUsd) }))
      .filter((p) => p.mrrUsd > 0)
      .sort((a, b) => b.mrrUsd - a.mrrUsd)
      .slice(0, 10);

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
      stripeFeesThisMonthUsd: round2(stripeFeesUsd),
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
      topPayers,
      demoExcluded,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
