-- Órdenes por día y estado (incluye estados propios de order_stages y las
-- canceladas) para la gráfica apilada de Órdenes → Métricas. Mismos cortes de
-- día que order_metrics.byDay (generate_series desde p_start), así el front
-- empareja las fechas tal cual. SECURITY INVOKER: la RLS de orders aplica.
create or replace function public.order_metrics_by_day_status(
  p_tenant_id bigint,
  p_start     timestamptz,
  p_end       timestamptz,
  p_use_bs    boolean default false,
  p_source    text default null
)
returns json
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select coalesce(json_agg(
    json_build_object(
      'date', day_start, 'status', status, 'stageId', stage_id,
      'count', cnt, 'amount', amt
    ) order by day_start, status
  ), '[]'::json)
  from (
    select gs.day_start,
           o.status,
           o.stage_id,
           count(*) as cnt,
           round(sum(coalesce(case when p_use_bs then o.total_bs else o.total_usd end, 0))::numeric, 2) as amt
    from generate_series(
           p_start,
           p_end - interval '1 microsecond',
           interval '1 day'
         ) as gs(day_start)
    join public.orders o
      on o.tenant_id = p_tenant_id
      and o.created_at >= gs.day_start
      and o.created_at <  gs.day_start + interval '1 day'
      and (p_source is null or o.source = p_source)
    group by gs.day_start, o.status, o.stage_id
  ) d;
$function$;

revoke all on function public.order_metrics_by_day_status(bigint, timestamptz, timestamptz, boolean, text) from public, anon;
grant execute on function public.order_metrics_by_day_status(bigint, timestamptz, timestamptz, boolean, text) to authenticated;
