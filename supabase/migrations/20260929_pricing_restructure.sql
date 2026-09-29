-- ═══════════════════════════════════════════════════════════════════════════
-- Pricing restructure 2026-09
--
-- Cambios:
--   1. Precios redondos: Pro $19.99 → $20, Avanzado $29.99 → $35.
--   2. Free trial de 7 días (con tarjeta) en la primera suscripción →
--      columna tenants.trial_used_at (se estampa cuando el trial arranca,
--      ver stripe-webhook checkout.session.completed).
--   3. Básico ($11.99) se DISCONTINÚA para altas nuevas pero queda
--      grandfathered: no se borra la fila (los 78 tenants que lo pagan siguen
--      igual, su suscripción está anclada al precio viejo en Stripe). El grid
--      de planes lo oculta salvo que sea el plan actual del tenant.
--   4. Trimestral retirado (solo mensual + anual −50%). No requiere DB: el
--      plumbing 'quarterly' queda inerte en el código.
--
-- ⚠️ ORDEN DE GO-LIVE (esto NO es reversible en prod — hay una sola DB):
--   a) Crear en Stripe los 4 precios nuevos:
--        pro monthly $20 · pro annual $120 (−50%)
--        avanzado monthly $35 · avanzado annual $210 (−50%)
--   b) Pegar esos price IDs en el PRICE_MAP de create-checkout-session y
--      change-plan (reemplazar los placeholders __GOLIVE__) y actualizar
--      abajo los UPDATE de stripe_price_id_*.
--   c) Aplicar esta migración.
--   d) Deployar las edge functions y pushear la app.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Free trial: marca de trial ya consumido (una vez por tenant).
alter table public.tenants
  add column if not exists trial_used_at timestamptz;

comment on column public.tenants.trial_used_at is
  'Momento en que el tenant consumió su free trial de 7 días (se estampa cuando arranca la sub con trial). NULL = todavía puede pedir trial.';

-- 2) Precios nuevos (display/orden; el cobro real sale del PRICE_MAP de Stripe).
update public.plans set price = 20, updated_at = now() where id = 'pro';
update public.plans set price = 35, updated_at = now() where id = 'avanzado';

-- 3) Sincronizar los stripe_price_id_* informativos de la tabla (los usa el
--    panel interno). IDs creados en Stripe live 2026-09-29.
update public.plans set
  stripe_price_id_monthly = 'price_1UL59T85rys2QLXdkrWZiIh1', -- $20
  stripe_price_id_annual  = 'price_1UL59g85rys2QLXdp7UiCjCQ', -- $120 (-50%)
  updated_at = now()
  where id = 'pro';
update public.plans set
  stripe_price_id_monthly = 'price_1UL59m85rys2QLXdC40TyaQE', -- $35
  stripe_price_id_annual  = 'price_1UL59r85rys2QLXdnrsXjQis', -- $210 (-50%)
  updated_at = now()
  where id = 'avanzado';
