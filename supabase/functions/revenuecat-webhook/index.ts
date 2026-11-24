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
//
// Compras de prueba (environment SANDBOX: Xcode/TestFlight) solo se registran:
// no tocan el plan real del tenant, salvo REVENUECAT_ALLOW_SANDBOX=true.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { fetchOwnerMatchData, sendPlatformEvent } from '../_shared/meta-platform-capi.ts';

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

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// Paquetes de créditos de IA (consumibles): `ch_credits_150`, `ch_credits_500`…
// En Google Play el id puede venir con sufijo; tomamos el número del prefijo.
function creditsFromProduct(productId) {
  const m = /^ch_credits_(\d+)/i.exec(productId ?? '');
  return m ? Number(m[1]) : null;
}

function planFromProduct(productId) {
  if (!productId) return null;
  // iOS: `ch_basico_monthly` (guion bajo). Google Play: `ch_basico:monthly`
  // (formato productId:basePlanId). Aceptamos ambos separadores.
  const m = productId.match(/^ch_(basico|pro|avanzado)[_:]/i);
  return m ? m[1].toLowerCase() : null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret || req.headers.get('Authorization') !== secret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const event = payload?.['event'];
  const eventId = event?.['id'];
  const type = event?.['type'];
  if (!event || !eventId || !type) return json({ ok: true, ignored: 'no_event' });

  // Dedupe (idempotencia): si ya se procesó este evento, no repetir.
  const { data: seen } = await supabase
    .from('iap_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (seen) return json({ ok: true, deduped: true });

  const appUserId = event['app_user_id'];

  // Resolver tenant del dueño (auth UUID → users → users_tenants owner).
  let tenantId = null;
  let userId = null;
  if (appUserId && !appUserId.startsWith('$RCAnonymousID')) {
    const { data: u } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', appUserId)
      .maybeSingle();
    userId = u?.id ?? null;
    if (u?.id) {
      const { data: ut } = await supabase
        .from('users_tenants')
        .select('tenant_id')
        .eq('user_id', u.id)
        .eq('role', 'owner')
        .order('tenant_id', { ascending: true })
        .limit(1)
        .maybeSingle();
      tenantId = ut?.tenant_id ?? null;
    }
  }

  const recordEvent = () =>
    supabase.from('iap_webhook_events').insert({
      event_id: eventId,
      event_type: type,
      app_user_id: appUserId ?? null,
      tenant_id: tenantId,
    });

  // ── Créditos de IA (consumibles) ──────────────────────────────────────
  // Van ANTES de los guards de plan (Stripe activo / plan manual): esos solo
  // aplican a suscripciones. El pozo de créditos es por usuario (users.id).
  // Sandbox SÍ acredita: el revisor de Apple compra en sandbox y tiene que ver
  // llegar los créditos (solo testers/revisores pueden comprar en sandbox).
  const creditProductId = event['product_id'] ?? null;
  const creditAmount = creditsFromProduct(creditProductId);
  if (creditAmount) {
    const store = event['store'] === 'PLAY_STORE' ? 'play_store' : 'app_store';
    const txId =
      event['transaction_id'] ?? event['original_transaction_id'] ?? null;
    if (!userId || !txId) {
      await recordEvent();
      return json({ ok: true, credits_skipped: !userId ? 'no_user' : 'no_tx' });
    }
    if (type === 'NON_RENEWING_PURCHASE') {
      const { data: added, error } = await supabase.rpc('grant_iap_credits', {
        p_user_id: userId,
        p_transaction_id: String(txId),
        p_product_id: creditProductId,
        p_credits: creditAmount,
        p_store: store,
        p_environment: event['environment'] ?? null,
        p_price_usd: typeof event['price'] === 'number' ? event['price'] : null,
        p_currency: event['currency'] ?? null,
        p_event_id: eventId,
      });
      if (error) {
        console.error('[revenuecat-webhook] grant_iap_credits failed', error);
        return json({ ok: false, error: 'credits_failed' }, 500);
      }
      await recordEvent();
      return json({ ok: true, credits_added: added ?? 0 });
    }
    if (type === 'CANCELLATION') {
      // En consumibles, CANCELLATION = reembolso de Apple/Google.
      const { data: removed, error } = await supabase.rpc('revoke_iap_credits', {
        p_transaction_id: String(txId),
      });
      if (error) {
        console.error('[revenuecat-webhook] revoke_iap_credits failed', error);
        return json({ ok: false, error: 'credits_revoke_failed' }, 500);
      }
      await recordEvent();
      return json({ ok: true, credits_removed: removed ?? 0 });
    }
    await recordEvent();
    return json({ ok: true, ignored: type, credits: true });
  }

  if (!tenantId) {
    await recordEvent();
    return json({ ok: true, no_tenant: true });
  }

  // Compras de prueba: se registran pero no cambian el plan real.
  if (
    String(event['environment'] ?? '').toUpperCase() === 'SANDBOX' &&
    Deno.env.get('REVENUECAT_ALLOW_SANDBOX') !== 'true'
  ) {
    await recordEvent();
    return json({ ok: true, sandbox_ignored: true });
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

  // Un plan asignado a mano desde el panel interno (tenant_subscriptions
  // activa y vigente) manda sobre IAP: no lo pisamos ni lo bajamos a gratis.
  const { data: manualSub } = await supabase
    .from('tenant_subscriptions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (manualSub) {
    await recordEvent();
    return json({ ok: true, manual_plan_active: true });
  }

  const entitlements = Array.isArray(event['entitlement_ids'])
    ? event['entitlement_ids']
    : [];
  const productId = event['new_product_id'] ?? event['product_id'] ?? null;
  const planId =
    PLAN_ENTITLEMENTS.find((p) => entitlements.includes(p)) ??
    planFromProduct(productId);
  const store = event['store'] === 'PLAY_STORE' ? 'play_store' : 'app_store';

  const base = {
    revenuecat_app_user_id: appUserId ?? null,
    iap_store: store,
    iap_product_id: productId,
  };

  let update = null;

  if (ACTIVE_TYPES.has(type) && planId) {
    const purchasedAt = event['purchased_at_ms'];
    const expiresAt = event['expiration_at_ms'];
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
    await recordEvent();
    return json({ ok: true, ignored: type });
  }

  const { error: upErr } = await supabase
    .from('tenants')
    .update(update)
    .eq('id', tenantId);
  if (upErr) {
    console.error('[revenuecat-webhook] update failed', upErr);
    return json({ ok: false, error: 'update_failed' }, 500);
  }

  await recordEvent();

  // Conversions API (píxel propio): compra de plan en la app. Prueba gratis =
  // StartTrial; primera compra pagada o conversión de la prueba = Purchase.
  // Renovaciones normales no se reportan. event_id por evento de RevenueCat
  // (ya deduplicado arriba por iap_webhook_events).
  const periodType = String(event['period_type'] ?? '').toUpperCase();
  const price = Number(event['price'] ?? 0); // USD según RevenueCat
  let metaEvent: 'StartTrial' | 'Purchase' | null = null;
  if (type === 'INITIAL_PURCHASE') metaEvent = periodType === 'TRIAL' ? 'StartTrial' : 'Purchase';
  else if (type === 'RENEWAL' && event['is_trial_conversion'] === true) metaEvent = 'Purchase';
  if (metaEvent && planId) {
    const match = await fetchOwnerMatchData(supabase, tenantId);
    await sendPlatformEvent({
      eventName: metaEvent,
      purchaseSource: event['store'] === 'APP_STORE' ? 'app_store'
        : event['store'] === 'PLAY_STORE' ? 'google_play' : 'revenuecat_other',
      eventId: `rc-${eventId}`,
      actionSource: 'other',
      eventTime: event['event_timestamp_ms'] ? Math.floor(event['event_timestamp_ms'] / 1000) : undefined,
      ...match,
      externalId: match.externalId ?? appUserId ?? null,
      value: metaEvent === 'StartTrial' ? 0 : price,
      currency: 'USD',
      contentName: planId,
    });
  }

  return json({ ok: true, tenantId, planId: planId ?? null, type });
});
