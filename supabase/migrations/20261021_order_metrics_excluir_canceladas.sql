-- order_metrics: las órdenes canceladas ya no suman en "Ventas hoy", "Monto facturado",
-- "Ticket promedio" ni en el gráfico por día. Siguen apareciendo en `byStatus`
-- (conteo por estado). Reporte de soporte: una venta cancelada seguía contando.
create or replace function public.order_metrics(
  p_tenant_id   bigint,
  p_start       timestamptz,
  p_end         timestamptz,
  p_today_start timestamptz,
  p_use_bs      boolean default false,
  p_source      text default null
)
returns json
language sql
stable
as $function$
  with range_orders as (
    select status,
           coalesce(case when p_use_bs then total_bs else total_usd end, 0)::numeric as amount
    from public.orders
    where tenant_id = p_tenant_id
      and created_at >= p_start
      and created_at <  p_end
      and (p_source is null or source = p_source)
  ),
  sales as (
    select amount from range_orders where status <> 'cancelled'
  ),
  payment_parts as (
    select coalesce(nullif(trim(p->>'method'), ''), 'Sin método') as method,
           case
             when p_use_bs then
               case when coalesce(o.total_usd, 0) <> 0
                    then coalesce((p->>'amount')::numeric, 0) * o.total_bs / o.total_usd
                    else 0 end
             else coalesce((p->>'amount')::numeric, 0)
           end as amount,
           o.id as order_id
    from public.orders o
    cross join lateral jsonb_array_elements(o.payments) p
    where o.tenant_id = p_tenant_id
      and o.created_at >= p_start
      and o.created_at <  p_end
      and (p_source is null or o.source = p_source)
      and o.status = 'completed'
      and jsonb_typeof(o.payments) = 'array'
      and jsonb_array_length(o.payments) > 0
    union all
    select coalesce(nullif(trim(o.payment_method), ''), 'Sin método'),
           coalesce(case when p_use_bs then o.total_bs else o.total_usd end, 0)::numeric,
           o.id
    from public.orders o
    where o.tenant_id = p_tenant_id
      and o.created_at >= p_start
      and o.created_at <  p_end
      and (p_source is null or o.source = p_source)
      and o.status = 'completed'
      and (o.payments is null or jsonb_typeof(o.payments) <> 'array'
           or jsonb_array_length(o.payments) = 0)
  )
  select json_build_object(
    'todayAmount', coalesce((
      select sum(coalesce(case when p_use_bs then total_bs else total_usd end, 0))
      from public.orders
      where tenant_id = p_tenant_id and created_at >= p_today_start
        and (p_source is null or source = p_source)
        and status <> 'cancelled'
    ), 0),
    'todayOrders', (
      select count(*) from public.orders
      where tenant_id = p_tenant_id and created_at >= p_today_start
        and (p_source is null or source = p_source)
        and status <> 'cancelled'
    ),
    'rangeTotalOrders', (select count(*) from sales),
    'rangeTotalAmount', coalesce((select sum(amount) from sales), 0),
    'rangeAvgTicket',   coalesce((select avg(amount) from sales), 0),
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
          and (p_source is null or o.source = p_source)
          and o.status <> 'cancelled'
        group by gs.day_start
      ) d
    ), '[]'::json),
    'byPaymentMethod', coalesce((
      select json_agg(
        json_build_object('method', label, 'count', cnt, 'amount', amt)
        order by amt desc
      )
      from (
        select (array_agg(method order by method desc))[1] as label,
               count(distinct order_id) as cnt,
               round(sum(amount), 2) as amt
        from payment_parts
        group by translate(lower(method), 'áéíóúü', 'aeiouu')
      ) m
    ), '[]'::json)
  );
$function$;
