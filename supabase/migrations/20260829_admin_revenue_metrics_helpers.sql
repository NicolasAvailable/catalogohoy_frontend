-- Helpers para la edge fn `admin-revenue-metrics` (Inicio del panel interno).
-- Devuelven la parte MANUAL de los ingresos (catálogos que pagan sin Stripe =
-- planes que activamos a mano). El lado Stripe lo arma la edge fn contra la API
-- porque tenant_subscriptions no registra las renovaciones de Stripe ni los
-- montos reales (solo ~2 de ~82 catálogos Stripe tienen amount en el ledger).
--
-- SECURITY DEFINER + solo service_role puede ejecutarlas (la edge fn ya validó
-- al admin interno vía JWT + _assert_internal_admin). Aplicado en prod vía MCP
-- 2026-08-29; este archivo queda como registro.

create or replace function public.admin_manual_paying_rows()
returns table(tenant_id bigint, plan_id text, amount_usd numeric, cycle text)
language sql
security definer
set search_path to 'public'
as $$
  select
    t.id as tenant_id,
    t.plan_id,
    (select ts.amount_usd from public.tenant_subscriptions ts
       where ts.tenant_id = t.id and ts.status = 'active'
       order by ts.started_at desc limit 1) as amount_usd,
    coalesce(
      (select ts.cycle from public.tenant_subscriptions ts
         where ts.tenant_id = t.id and ts.status = 'active'
         order by ts.started_at desc limit 1),
      'monthly') as cycle
  from public.tenants t
  where t.plan_id in ('basico','pro','avanzado','enterprise')
    and t.stripe_subscription_id is null
    and (
      exists (select 1 from public.tenant_subscriptions ts
                where ts.tenant_id = t.id and ts.status = 'active'
                  and ts.expires_at is not null and ts.expires_at > now())
      or (coalesce(t.plan_expired, false) = false
          and (t.plan_expires_at is null or t.plan_expires_at >= now()))
    );
$$;

create or replace function public.admin_manual_month_totals()
returns table(collected_usd numeric, new_count integer)
language sql
security definer
set search_path to 'public'
as $$
  select
    coalesce(sum(ts.amount_usd), 0)::numeric as collected_usd,
    count(*)::int as new_count
  from public.tenant_subscriptions ts
  join public.tenants t on t.id = ts.tenant_id
  where t.stripe_subscription_id is null
    and date_trunc('month', ts.started_at) = date_trunc('month', now());
$$;

revoke all on function public.admin_manual_paying_rows() from public, anon, authenticated;
revoke all on function public.admin_manual_month_totals() from public, anon, authenticated;
grant execute on function public.admin_manual_paying_rows() to service_role;
grant execute on function public.admin_manual_month_totals() to service_role;
