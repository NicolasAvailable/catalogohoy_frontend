// Internal-only edge function (CAT-107 + CAT-108, 2026-11-15): días entre el
// registro y el primer pago, y frecuencia de pago (mensual/trimestral/anual).
//
// El primer cobro de Stripe no está en la base, así que acá leemos de Stripe:
//   • invoices status=paid con amount_paid > 0 y suscripción → primer pago por customer
//   • subscriptions activas/past_due → intervalo (mensual, trimestral, anual)
// y se lo pasamos al RPC `time_to_pay_admin`, que junta con App Store/Play y
// pagos manuales, excluye demos y arma cohortes por día de registro.
//
// Auth: JWT del caller + public._assert_internal_admin() (el RPC también lo
// valida porque se llama con el JWT del caller, no con service role).
//
// POST { days?: number }  → respuesta del RPC (ver migración 20261115_time_to_pay_admin.sql)
//
// Env: STRIPE_SECRET_KEY · SUPABASE_URL / SUPABASE_ANON_KEY (auto).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE = 'https://api.stripe.com/v1';
const SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

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
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error (${res.status})`);
  return data;
}

// deno-lint-ignore no-explicit-any
async function stripeList(path: string, params: Record<string, string>): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const out: any[] = [];
  let startingAfter: string | undefined;
  // Tope de seguridad: 50 páginas * 100 = 5000 filas.
  for (let page = 0; page < 50; page++) {
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

const custId = (c: unknown): string | undefined =>
  typeof c === 'string' ? c : (c as { id?: string } | null)?.id;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!SECRET) return json({ error: 'STRIPE_SECRET_KEY not configured' }, 500);

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

    let days = 30;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body?.days) days = Number(body.days) || 30;
      } catch { /* sin body */ }
    }

    const [invoices, subs] = await Promise.all([
      // Solo campos que usamos; los invoices de $0 (trial) no cuentan como pago.
      stripeList('/invoices', { status: 'paid' }),
      stripeList('/subscriptions', { status: 'all' }),
    ]);

    const first = new Map<string, number>();
    for (const inv of invoices) {
      if (!(Number(inv.amount_paid) > 0)) continue;
      const isSub =
        !!inv.subscription ||
        !!inv.parent?.subscription_details?.subscription ||
        String(inv.billing_reason ?? '').startsWith('subscription');
      if (!isSub) continue;
      const c = custId(inv.customer);
      if (!c) continue;
      const paidAt = Number(inv.status_transitions?.paid_at ?? inv.created ?? 0);
      if (!paidAt) continue;
      const cur = first.get(c);
      if (cur == null || paidAt < cur) first.set(c, paidAt);
    }
    const stripeFirst = [...first.entries()].map(([c, t]) => ({
      c,
      t: new Date(t * 1000).toISOString(),
    }));

    const live = new Set(['active', 'past_due']);
    const stripeActive = subs
      .filter((s) => live.has(s.status))
      .map((s) => {
        const rec = s.items?.data?.[0]?.price?.recurring ?? {};
        return { c: custId(s.customer), i: rec.interval ?? 'month', n: Number(rec.interval_count ?? 1) || 1 };
      })
      .filter((x) => !!x.c);

    const { data, error } = await supabase.rpc('time_to_pay_admin', {
      p_days: days,
      p_stripe_first: stripeFirst,
      p_stripe_active: stripeActive,
    });
    if (error) return json({ error: error.message }, 500);

    return json({ asOf: new Date().toISOString(), stripeCustomersPaid: stripeFirst.length, ...data });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
