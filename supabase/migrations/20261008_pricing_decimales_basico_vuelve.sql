-- Pricing con decimales (2026-10-08): Pro $19.99 / Avanzado $34.99.
-- El Básico ($11.99) vuelve a ofrecerse en altas nuevas — no cambia de precio,
-- solo se des-oculta en la app (sin cambios de DB; sus price IDs siguen vigentes).
--
-- Los price IDs nuevos (batch pricing-decimals-2026-10, multimoneda) viven en
-- el PRICE_MAP de las edge functions create-checkout-session y change-plan —
-- esa es la fuente de verdad del cobro; estas columnas son informativas.
-- Las subs existentes a $20/$35 quedan ancladas a sus precios viejos en Stripe.

update public.plans
set price = 19.99,
    stripe_price_id_monthly = 'price_1UOJEz85rys2QLXdD2qy2sbm',
    stripe_price_id_annual  = 'price_1UOJFA85rys2QLXd5NgVNHLY',
    updated_at = now()
where id = 'pro';

update public.plans
set price = 34.99,
    stripe_price_id_monthly = 'price_1UOJFK85rys2QLXdN1DNC5Uh',
    stripe_price_id_annual  = 'price_1UOJFV85rys2QLXdkcOdcw0T',
    updated_at = now()
where id = 'avanzado';
