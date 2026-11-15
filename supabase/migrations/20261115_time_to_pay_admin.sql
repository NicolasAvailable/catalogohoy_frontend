-- CAT-107 + CAT-108 (2026-11-15): tiempo de registro → primer pago y
-- frecuencia de pago, para el Panel interno (Métricas del negocio).
--
-- El primer pago de Stripe NO está en la base (tenant_subscriptions no guarda
-- los cobros de Stripe), así que la edge fn `admin-time-to-pay` lee de Stripe
-- el primer invoice pagado (> $0) de cada customer y las suscripciones vivas,
-- y se los pasa a este RPC. El RPC junta con:
--   • App Store / Play  → primer INITIAL_PURCHASE en iap_webhook_events
--                         (fallback: plan_started_at del catálogo IAP)
--   • Manual            → primer tenant_subscriptions con amount_usd > 0
-- y lo lleva al dueño (users_tenants.role = 'owner'). Catálogos demo fuera.
--
-- p_stripe_first : [{ "c": "cus_…", "t": "2026-06-01T20:58:41Z" }]
-- p_stripe_active: [{ "c": "cus_…", "i": "month"|"year"|"week"|"day", "n": 1 }]

create or replace function public.time_to_pay_admin(
  p_days int default 30,
  p_stripe_first jsonb default '[]'::jsonb,
  p_stripe_active jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tz text := 'America/Caracas';
  v_today date := (now() at time zone 'America/Caracas')::date;
  v_days int := greatest(least(coalesce(p_days, 30), 180), 1);
  v_from timestamptz;
  result jsonb;
begin
  perform public._assert_internal_admin();
  v_from := (v_today - (v_days - 1))::timestamp at time zone v_tz;

  with
  stripe_first as (
    select x->>'c' as customer, min((x->>'t')::timestamptz) as paid_at
    from jsonb_array_elements(coalesce(p_stripe_first, '[]'::jsonb)) x
    where x->>'c' is not null and x->>'t' is not null
    group by 1
  ),
  tenant_first as (
    -- Stripe
    select t.id as tenant_id, sf.paid_at, 'stripe'::text as source
    from stripe_first sf join tenants t on t.stripe_customer_id = sf.customer
    where not t.is_demo
    union all
    -- App Store / Play: compra inicial
    select e.tenant_id, min(e.received_at), 'iap'
    from iap_webhook_events e join tenants t on t.id = e.tenant_id
    where e.event_type = 'INITIAL_PURCHASE' and not t.is_demo
    group by e.tenant_id
    union all
    -- IAP sin evento guardado (compras previas al log)
    select t.id, t.plan_started_at, 'iap'
    from tenants t
    where t.iap_store is not null and t.plan_started_at is not null and not t.is_demo
      and not exists (select 1 from iap_webhook_events e
                       where e.tenant_id = t.id and e.event_type = 'INITIAL_PURCHASE')
    union all
    -- Manual (pagos que registramos nosotros)
    select ts.tenant_id, min(ts.started_at), 'manual'
    from tenant_subscriptions ts join tenants t on t.id = ts.tenant_id
    where coalesce(ts.amount_usd, 0) > 0 and not t.is_demo
    group by ts.tenant_id
  ),
  -- Primer pago por usuario dueño (el más temprano de sus catálogos/fuentes).
  user_first as (
    select distinct on (ut.user_id)
      ut.user_id, tf.paid_at, tf.source
    from tenant_first tf
    join users_tenants ut on ut.tenant_id = tf.tenant_id and ut.role = 'owner'
    order by ut.user_id, tf.paid_at asc
  ),
  demo_users as (
    select distinct ut.user_id from users_tenants ut
    join tenants t on t.id = ut.tenant_id where t.is_demo
  ),
  usr as (
    select u.id, u.created_at,
      (u.created_at at time zone v_tz)::date as d,
      uf.paid_at, uf.source,
      case when uf.paid_at is null then null
           else greatest(floor(extract(epoch from (uf.paid_at - u.created_at)) / 86400), 0)::int
      end as days_to_pay
    from users u
    left join user_first uf on uf.user_id = u.id
    where not exists (select 1 from demo_users du where du.user_id = u.id)
  ),
  win as (select * from usr where created_at >= v_from),
  days as (
    select generate_series(v_today - (v_days - 1), v_today, interval '1 day')::date as d
  ),
  per_day as (
    select days.d,
      count(w.id)::int as signups,
      count(w.paid_at)::int as paid,
      round(avg(w.days_to_pay)::numeric, 1) as avg_days
    from days left join win w on w.d = days.d
    group by days.d
  ),
  bucketed as (
    select *, case
      when days_to_pay = 0 then '0'
      when days_to_pay <= 3 then '1-3'
      when days_to_pay <= 7 then '4-7'
      when days_to_pay <= 14 then '8-14'
      when days_to_pay <= 30 then '15-30'
      else '31+' end as bucket
    from usr where paid_at is not null
  ),
  bucket_order as (
    select * from (values ('0',1),('1-3',2),('4-7',3),('8-14',4),('15-30',5),('31+',6)) v(bucket, ord)
  ),
  -- Por mes de registro (cohorte): cada mes con sus registros, pagos y días.
  months as (
    select to_char(date_trunc('month', d), 'YYYY-MM') as month,
      count(*)::int as signups,
      count(paid_at)::int as paid,
      count(*) filter (where days_to_pay = 0)::int as same_day,
      count(*) filter (where days_to_pay <= 7)::int as within7,
      round(avg(days_to_pay)::numeric, 1) as avg_days,
      percentile_cont(0.5) within group (order by days_to_pay) filter (where paid_at is not null) as median_days,
      count(*) filter (where days_to_pay between 1 and 3)::int as b1_3,
      count(*) filter (where days_to_pay between 4 and 7)::int as b4_7,
      count(*) filter (where days_to_pay between 8 and 14)::int as b8_14,
      count(*) filter (where days_to_pay between 15 and 30)::int as b15_30,
      count(*) filter (where days_to_pay > 30)::int as b31
    from usr
    where d >= (date_trunc('month', v_today) - interval '11 months')::date
    group by 1
  ),
  -- Frecuencia de pago (pagos vivos hoy)
  stripe_active as (
    select distinct on (t.id) t.id as tenant_id,
      case
        when x->>'i' = 'year' then 'annual'
        when x->>'i' = 'month' and coalesce((x->>'n')::int, 1) = 3 then 'quarterly'
        when x->>'i' = 'month' and coalesce((x->>'n')::int, 1) = 6 then 'semiannual'
        when x->>'i' = 'month' then 'monthly'
        else 'other' end as cycle
    from jsonb_array_elements(coalesce(p_stripe_active, '[]'::jsonb)) x
    join tenants t on t.stripe_customer_id = x->>'c'
    where not t.is_demo
    order by t.id
  ),
  manual_active as (
    select m.tenant_id,
      case when t.iap_store is not null then t.iap_store else 'manual' end as source,
      case
        when t.iap_store is not null and t.iap_product_id ilike '%annual%' then 'annual'
        when t.iap_store is not null then 'monthly'
        else coalesce(m.cycle, 'monthly') end as cycle
    from public.admin_manual_paying_rows() m join tenants t on t.id = m.tenant_id
  ),
  freq as (
    select 'stripe'::text as source, cycle from stripe_active
    union all
    select source, cycle from manual_active
  )
  select jsonb_build_object(
    'days', v_days,
    'window', jsonb_build_object(
      'signups', (select count(*) from win),
      'paid', (select count(paid_at) from win),
      'avgDays', (select round(avg(days_to_pay)::numeric, 1) from win),
      'medianDays', (select percentile_cont(0.5) within group (order by days_to_pay) from win where paid_at is not null),
      'paidWithin7', (select count(*) from win where days_to_pay <= 7)
    ),
    'allTime', jsonb_build_object(
      'payers', (select count(*) from bucketed),
      'avgDays', (select round(avg(days_to_pay)::numeric, 1) from bucketed),
      'medianDays', (select percentile_cont(0.5) within group (order by days_to_pay) from bucketed),
      'sameDayPct', (select round(100.0 * count(*) filter (where days_to_pay = 0) / nullif(count(*), 0), 1) from bucketed),
      'within7Pct', (select round(100.0 * count(*) filter (where days_to_pay <= 7) / nullif(count(*), 0), 1) from bucketed),
      'buckets', (select jsonb_agg(jsonb_build_object('bucket', bo.bucket, 'count',
                    (select count(*) from bucketed b where b.bucket = bo.bucket)) order by bo.ord)
                  from bucket_order bo),
      'bySource', (select coalesce(jsonb_object_agg(source, n), '{}'::jsonb)
                   from (select source, count(*) n from bucketed group by source) s)
    ),
    'months', coalesce((select jsonb_agg(jsonb_build_object(
        'month', month, 'signups', signups, 'paid', paid, 'sameDay', same_day,
        'within7', within7, 'avgDays', avg_days, 'medianDays', median_days,
        'buckets', jsonb_build_array(
          jsonb_build_object('bucket', '0', 'count', same_day),
          jsonb_build_object('bucket', '1-3', 'count', b1_3),
          jsonb_build_object('bucket', '4-7', 'count', b4_7),
          jsonb_build_object('bucket', '8-14', 'count', b8_14),
          jsonb_build_object('bucket', '15-30', 'count', b15_30),
          jsonb_build_object('bucket', '31+', 'count', b31))
      ) order by month desc) from months), '[]'::jsonb),
    'series', coalesce((select jsonb_agg(jsonb_build_object(
        'day', d, 'signups', signups, 'paid', paid, 'avgDays', avg_days) order by d) from per_day), '[]'::jsonb),
    'frequency', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'cycle', cycle, 'count', n)
                   order by n desc)
                 from (select source, cycle, count(*)::int n from freq group by 1, 2) f), '[]'::jsonb)
  ) into result;

  return result;
end;
$function$;

revoke all on function public.time_to_pay_admin(int, jsonb, jsonb) from public, anon;
grant execute on function public.time_to_pay_admin(int, jsonb, jsonb) to authenticated;
