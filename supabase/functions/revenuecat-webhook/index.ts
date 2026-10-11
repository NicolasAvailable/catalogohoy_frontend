// RevenueCat → Supabase: escribe el plan del tenant igual que el stripe-webhook.
// Lo invoca RevenueCat (Integrations → Webhooks) ante compras/renovaciones/
// cancelaciones de IAP. Autenticación propia por header `Authorization` contra
// REVENUECAT_WEBHOOK_SECRET (NO usa JWT de Supabase → verify_jwt:false).
//
// Resolución del tenant: event.app_user_id (= auth UUID de Supabase, que la app
// pasa en Purchases.configure) → users.auth_user_id → users_tenants (owner) →
// tenant_id. El estado del plan vive en las columnas existentes de `tenants`
// (plan_id, plan_started_at, plan_expires_at, plan_expired); se agregan iap_*
// de procedencia. Idempotente (dedupe por event.id en iap_webhook_events).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Prioridad alto→bajo: si el evento trae varios entitlements, gana el mayor.
const PLAN_ENTITLEMENTS = ['avanzado', 'pro', 'basico'];
const ACTIVE_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
  'NON_RENEWING_PURCHASE',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function planFromProduct(productId?: string | null): string | null {
  if (!productId) return null;
  const m = productId.match(/^ch_(basico|pro|avanzado)_/i);
  return m ? m[1].toLowerCase() : null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret || req.headers.get('Authorization') !== secret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const event = payload?.['event'] as Record<string, unknown> | undefined;
  const eventId = event?.['id'] as string | undefined;
  const type = event?.['type'] as string | undefined;
  if (!event || !eventId || !type) return json({ ok: true, ignored: 'no_event' });

  // Dedupe (idempotencia): si ya se procesó este evento, no repetir.
  const { data: seen } = await supabase
    .from('iap_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (seen) return json({ ok: true, deduped: true });

  const appUserId = event['app_user_id'] as string | undefined;

  // Resolver tenant del dueño (auth UUID → users → users_tenants owner).
  let tenantId: number | null = null;
  if (appUserId && !appUserId.startsWith('$RCAnonymousID')) {
    const { data: u } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', appUserId)
      .maybeSingle();
    if (u?.id) {
      const { data: ut } = await supabase
        .from('users_tenants')
        .select('tenant_id')
        .eq('user_id', u.id)
        .eq('role', 'owner')
        .order('tenant_id', { ascending: true })
        .limit(1)
        .maybeSingle();
      tenantId = (ut?.tenant_id as number) ?? null;
    }
  }

  const recordEvent = () =>
    supabase.from('iap_webhook_events').insert({
      event_id: eventId,
      event_type: type,
      app_user_id: appUserId ?? null,
      tenant_id: tenantId,
    });

  if (!tenantId) {
    await recordEvent();
    return json({ ok: true, no_tenant: true });
  }

  // Guard anti doble-cobro: si hay una suscripción Stripe ACTIVA (web), no la
  // pisamos con IAP (la paywall de la app también bloquea comprar en ese caso).
  const { data: tenant } = await supabase
    .from('tenants')
    .select('stripe_subscription_status')
    .eq('id', tenantId)
    .maybeSingle();
  if (tenant?.stripe_subscription_status === 'active') {
    await recordEvent();
    return json({ ok: true, stripe_active: true });
  }

  const entitlements = Array.isArray(event['entitlement_ids'])
    ? (event['entitlement_ids'] as string[])
    : [];
  const productId =
    (event['new_product_id'] as string) ??
    (event['product_id'] as string) ??
    null;
  const planId =
    PLAN_ENTITLEMENTS.find((p) => entitlements.includes(p)) ??
    planFromProduct(productId);
  const store = event['store'] === 'PLAY_STORE' ? 'play_store' : 'app_store';

  const base: Record<string, unknown> = {
    revenuecat_app_user_id: appUserId ?? null,
    iap_store: store,
    iap_product_id: productId,
  };

  let update: Record<string, unknown> | null = null;

  if (ACTIVE_TYPES.has(type) && planId) {
    const purchasedAt = event['purchased_at_ms'] as number | undefined;
    const expiresAt = event['expiration_at_ms'] as number | undefined;
    update = {
      ...base,
      plan_id: planId,
      plan_started_at: purchasedAt
        ? new Date(purchasedAt).toISOString()
        : new Date().toISOString(),
      plan_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      plan_expired: false,
      iap_subscription_status: 'active',
    };
    const period = String(event['period_type'] ?? '').toUpperCase();
    if (period === 'TRIAL') update['trial_used_at'] = new Date().toISOString();
  } else if (type === 'CANCELLATION') {
    // Cancelado pero con acceso hasta plan_expires_at (no se baja el plan acá).
    update = { ...base, iap_subscription_status: 'cancelled' };
  } else if (type === 'BILLING_ISSUE') {
    update = { ...base, iap_subscription_status: 'billing_issue' };
  } else if (type === 'EXPIRATION') {
    update = {
      ...base,
      plan_id: 'gratis',
      plan_expired: true,
      iap_subscription_status: 'expired',
    };
  }

  if (!update) {
    // TRANSFER u otros tipos que no cambian el plan: solo se registran.
    await recordEvent();
    return json({ ok: true, ignored: type });
  }

  const { error: upErr } = await supabase
    .from('tenants')
    .update(update)
    .eq('id', tenantId);
  if (upErr) {
    // NO registramos el evento → RevenueCat reintenta y se reaplica (idempotente).
    console.error('[revenuecat-webhook] update failed', upErr);
    return json({ ok: false, error: 'update_failed' }, 500);
  }

  await recordEvent();
  return json({ ok: true, tenantId, planId: planId ?? null, type });
});
