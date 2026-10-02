-- business_metrics_admin(): agregados de negocio para el panel interno
-- (altas de catálogos por mes + MoM, comercios activos por mes, mix de planes
-- pagos y conteo de catálogos pagos). Read-only, gated por _assert_internal_admin.
-- Los ingresos (MRR/ARR/cobrado) salen de la edge fn admin-revenue-metrics.
create or replace function public.business_metrics_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_month_start date := date_trunc('month', v_now)::date;
  v_prev_start date := (date_trunc('month', v_now) - interval '1 month')::date;
  v_from timestamptz := date_trunc('month', v_now) - interval '11 months';
  result jsonb;
begin
  perform _assert_internal_admin();

  with months as (
    select generate_series(date_trunc('month', v_now) - interval '11 months',
                           date_trunc('month', v_now), interval '1 month')::date as m
  ),
  signups as (
    select date_trunc('month', created_at)::date as m, count(*)::int c
    from tenants where created_at >= v_from group by 1
  ),
  active as (
    select date_trunc('month', created_at)::date as m, count(distinct tenant_id)::int c
    from orders where created_at >= v_from group by 1
  ),
  paid as (
    select plan_id from tenants
    where plan_id is not null and plan_id <> 'gratis' and plan_id <> 'enterprise'
      and (
        coalesce(stripe_subscription_status,'') in ('active','trialing','past_due')
        or (stripe_subscription_id is null and coalesce(plan_expired,false) = false)
      )
  )
  select jsonb_build_object(
    'monthStart', v_month_start,
    'signups', jsonb_build_object(
      'thisMonth', coalesce((select c from signups where m = v_month_start),0),
      'prevMonth', coalesce((select c from signups where m = v_prev_start),0),
      'series', coalesce((select jsonb_agg(jsonb_build_object('month', mo.m, 'count', coalesce(s.c,0)) order by mo.m)
                          from months mo left join signups s on s.m = mo.m), '[]'::jsonb)
    ),
    'activeMerchants', jsonb_build_object(
      'thisMonth', coalesce((select c from active where m = v_month_start),0),
      'prevMonth', coalesce((select c from active where m = v_prev_start),0),
      'series', coalesce((select jsonb_agg(jsonb_build_object('month', mo.m, 'count', coalesce(a.c,0)) order by mo.m)
                          from months mo left join active a on a.m = mo.m), '[]'::jsonb)
    ),
    'planMix', coalesce((select jsonb_agg(jsonb_build_object('planId', plan_id, 'count', c) order by c desc)
                         from (select plan_id, count(*)::int c from paid group by plan_id) pm), '[]'::jsonb),
    'payingCount', (select count(*)::int from paid)
  ) into result;

  return result;
end;
$$;

grant execute on function public.business_metrics_admin() to authenticated;
