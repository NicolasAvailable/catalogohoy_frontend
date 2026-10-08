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

-- snapshot_mrr_monthly() tenía los precios hardcodeados (avanzado seguía en
-- 29.99 desde antes del switch de sept). Se re-crea leyendo plans.price para
-- que los futuros cambios de precio no la desincronicen. Enterprise mantiene
-- su default sugerido (99.99) porque plans.price=0 para ese plan.
create or replace function public.snapshot_mrr_monthly()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_count int;
begin
  insert into mrr_snapshots (month_start, tenant_id, plan_id, mrr_usd)
  select
    v_month, t.id, t.plan_id,
    (case when t.plan_id = 'enterprise' then 99.99
          else coalesce(p.price, 0) end)
    + coalesce(t.extra_catalogs, 0) * 4.99
  from tenants t
  left join plans p on p.id = t.plan_id
  where t.plan_id is not null and t.plan_id <> 'gratis'
    and (
      coalesce(t.stripe_subscription_status,'') in ('active','trialing','past_due')
      or (t.stripe_subscription_id is null and coalesce(t.plan_expired,false) = false)
    )
  on conflict (month_start, tenant_id) do update
    set plan_id = excluded.plan_id,
        mrr_usd = excluded.mrr_usd,
        captured_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
