-- Agregados de órdenes para el tab "Métricas" de la vista de órdenes.
-- Los límites de fecha llegan calculados por el cliente (zona horaria del admin):
--   [p_start, p_end)  = rango seleccionado;  p_today_start = medianoche local de hoy.
-- p_use_bs: el front decide la moneda del catálogo — si el catálogo muestra su
--   moneda de referencia (USD/EUR o local) suma total_usd; si es solo-bolívares
--   (Venezuela con referencia oculta) suma total_bs.
-- SECURITY INVOKER (default): corre como el llamador y respeta el RLS de orders.
drop function if exists public.order_metrics(integer, timestamptz, timestamptz, timestamptz);
drop function if exists public.order_metrics(bigint, timestamptz, timestamptz, timestamptz);

create or replace function public.order_metrics(
  p_tenant_id   bigint,
  p_start       timestamptz,
  p_end         timestamptz,
  p_today_start timestamptz,
  p_use_bs      boolean default false
)
returns json
language sql
stable
as $$
  with range_orders as (
    select status,
           coalesce(case when p_use_bs then total_bs else total_usd end, 0)::numeric as amount
    from public.orders
    where tenant_id = p_tenant_id
      and created_at >= p_start
      and created_at <  p_end
  )
  select json_build_object(
    'todayAmount', coalesce((
      select sum(coalesce(case when p_use_bs then total_bs else total_usd end, 0))
      from public.orders
      where tenant_id = p_tenant_id and created_at >= p_today_start
    ), 0),
    'todayOrders', (
      select count(*) from public.orders
      where tenant_id = p_tenant_id and created_at >= p_today_start
    ),
    'rangeTotalOrders', (select count(*) from range_orders),
    'rangeTotalAmount', coalesce((select sum(amount) from range_orders), 0),
    'rangeAvgTicket',   coalesce((select avg(amount) from range_orders), 0),
    'byStatus', coalesce((
      select json_agg(
        json_build_object('status', status, 'count', cnt, 'amount', amt)
        order by status
      )
      from (
        select status, count(*) as cnt, sum(amount) as amt
        from range_orders
        group by status
      ) s
    ), '[]'::json),
    -- Serie diaria para el area chart. Los buckets se alinean a los días LOCALES
    -- del admin: como p_start ya es la medianoche local (como instante), generar
    -- la serie en pasos de 1 día produce fronteras en cada medianoche local.
    'byDay', coalesce((
      select json_agg(
        json_build_object('date', day_start, 'amount', amt, 'count', cnt)
        order by day_start
      )
      from (
        select gs.day_start,
               coalesce(sum(coalesce(case when p_use_bs then o.total_bs else o.total_usd end, 0)), 0)::numeric as amt,
               count(o.id) as cnt
        from generate_series(
               p_start,
               p_end - interval '1 microsecond',
               interval '1 day'
             ) as gs(day_start)
        left join public.orders o
          on o.tenant_id = p_tenant_id
          and o.created_at >= gs.day_start
          and o.created_at <  gs.day_start + interval '1 day'
        group by gs.day_start
      ) d
    ), '[]'::json)
  );
$$;

grant execute on function public.order_metrics(bigint, timestamptz, timestamptz, timestamptz, boolean)
  to authenticated, anon;
