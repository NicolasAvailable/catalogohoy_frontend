// Internal-only edge function: historial REAL de Stripe de un tenant para el
// detalle de catálogo del panel interno (apps/internal, /tenants/:id).
//
// Motivo: las renovaciones de Stripe no se registran en tenant_subscriptions
// (stripe-webhook solo actualiza tenants.plan_*), así que el detalle las trae
// directo de la API de Stripe: suscripciones (todas) + facturas pagadas del
// stripe_customer_id del tenant. La secret key nunca llega al browser.
//
// Auth: mismo doble gate que manage-stripe-coupons — JWT del caller +
// public._assert_internal_admin() (única fuente de verdad de admin interno).
//
// POST body: { tenantId: number }
// Respuesta: {
//   customerId: string | null,          // null ⇒ el tenant nunca usó Stripe
//   paidTotalUsd: number | null,        // cents, BRUTO liquidado en USD
//   subscriptions: [{ id, status, created, currentPeriodEnd,
//                     cancelAtPeriodEnd, canceledAt, planNickname, interval,
//                     amount, currency }],
//   invoices:      [{ id, number, status, amountPaid, currency, created,
//                     description, hostedInvoiceUrl }],
// }
//
// ⚠️ Adaptive Pricing: Stripe puede presentar la factura en moneda local
// (p.ej. HNL) aunque el plan sea USD. `amountPaid`/`currency` de cada factura
// son lo que vio el cliente; `paidTotalUsd` sale de los balance_transactions
// de los charges (bruto liquidado en USD) — usar ESE para "cuánto nos pagó".
//
// Env: STRIPE_SECRET_KEY (requerida) · SUPABASE_URL / SUPABASE_ANON_KEY /
//      SUPABASE_SERVICE_ROLE_KEY (auto-provistas).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE = 'https://api.stripe.com/v1';
const SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

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

    const body = await req.json().catch(() => ({}));
    const tenantId = Number(body.tenantId);
    if (!Number.isFinite(tenantId)) {
      return json({ error: 'Falta tenantId' }, 400);
    }

    // --- Customer de Stripe del tenant (service role) -----------------------
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .select('stripe_customer_id')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenantErr) return json({ error: tenantErr.message }, 400);

    const customerId = tenant?.stripe_customer_id ?? null;
    if (!customerId) {
      return json({ customerId: null, subscriptions: [], invoices: [] });
    }

    // --- Stripe: suscripciones (todas) + facturas + charges -----------------
    // Los charges traen su balance_transaction: el monto BRUTO liquidado en
    // USD aunque la factura se haya presentado en moneda local (Adaptive
    // Pricing). Las versiones nuevas de la API ya no exponen invoice.charge,
    // por eso se listan los charges del customer por separado.
    const [subs, invoices, charges] = await Promise.all([
      stripeGet('/subscriptions', {
        customer: customerId,
        status: 'all',
        limit: '20',
      }),
      stripeGet('/invoices', { customer: customerId, limit: '100' }),
      stripeGet('/charges', {
        customer: customerId,
        limit: '100',
        'expand[]': 'data.balance_transaction',
      }).catch(() => null),
    ]);

    // Total BRUTO cobrado, liquidado en USD (cents). null si no se pudo leer.
    let paidTotalUsd: number | null = null;
    if (charges?.data) {
      paidTotalUsd = 0;
      for (const c of charges.data) {
        if (!c.paid || c.refunded) continue;
        const bt =
          typeof c.balance_transaction === 'object'
            ? c.balance_transaction
            : null;
        if (bt?.currency === 'usd') paidTotalUsd += bt.amount;
        else if (c.currency === 'usd') paidTotalUsd += c.amount;
      }
    }

    return json({
      customerId,
      paidTotalUsd,
      // deno-lint-ignore no-explicit-any
      subscriptions: (subs.data ?? []).map((s: any) => {
        const item = s.items?.data?.[0];
        const price = item?.price;
        return {
          id: s.id,
          status: s.status,
          created: s.created,
          // En versiones nuevas de la API el period vive en el item.
          currentPeriodEnd:
            s.current_period_end ?? item?.current_period_end ?? null,
          cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
          canceledAt: s.canceled_at ?? null,
          planNickname:
            price?.nickname ?? price?.metadata?.plan_id ??
            s.metadata?.plan_id ?? null,
          interval: price?.recurring?.interval ?? null,
          amount: price?.unit_amount ?? null,
          currency: price?.currency ?? null,
        };
      }),
      // Solo facturas con plata cobrada (amount_paid > 0 y status paid);
      // las draft/void/uncollectible no son pagos.
      // deno-lint-ignore no-explicit-any
      invoices: (invoices.data ?? [])
        .filter((i: any) => i.status === 'paid' && (i.amount_paid ?? 0) > 0)
        .map((i: any) => ({
          id: i.id,
          number: i.number ?? null,
          status: i.status,
          amountPaid: i.amount_paid,
          currency: i.currency,
          created: i.created,
          description:
            i.lines?.data?.[0]?.description ?? i.description ?? null,
          hostedInvoiceUrl: i.hosted_invoice_url ?? null,
        })),
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
