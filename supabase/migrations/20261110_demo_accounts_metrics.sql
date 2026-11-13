-- =============================================================================
-- Cuentas demo + métricas de negocio más claras — 2026-11-10
--
-- 1. `tenants.is_demo`: catálogos de demo/prueba (p. ej. los de Nicolas) que
--    tienen plan pero NO son clientes que pagan. Se excluyen de TODAS las
--    métricas del panel interno (MRR, pagos, churn, conversión, snapshots…).
--    Solo el admin interno puede cambiarla (trigger de guarda + RPC).
-- 2. `signup_conversion_daily_admin`: registros por día y cuántos de esos
--    usuarios hoy pagan (o pagaron) → "1 de cada N se convierte".
-- 3. `churn_summary_admin`: churn claro por catálogo, desde las fotos
--    mensuales de MRR (`mrr_snapshots`): quién pagaba al inicio del mes y ya
--    no paga hoy (mes en curso) y el cierre del mes anterior.
-- 4. Todas las RPCs de métricas existentes filtran `is_demo`.
-- Sin tablas nuevas (no aplica RLS nuevo). La columna es de solo lectura
-- pública como el resto de `tenants` (policy tenants_select).
-- =============================================================================

alter table public.tenants
  add column if not exists is_demo boolean not null default false;

-- Guarda: un dueño de tienda no puede marcar/desmarcar su catálogo como demo
-- (la policy tenants_update le deja editar su fila). Solo el admin interno,
-- service_role o el SQL editor (auth.uid() null).
create or replace function public._guard_tenant_is_demo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_is_admin boolean;
begin
  if auth.uid() is null then
    return new;
  end if;
  select exists (
    select 1 from auth.users au
    where au.id = auth.uid() and au.email = 'nicaso3006@gmail.com'
  ) into v_is_admin;
  if v_is_admin then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_demo := false;
  elsif new.is_demo is distinct from old.is_demo then
    new.is_demo := old.is_demo;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_tenant_is_demo on public.tenants;
create trigger trg_guard_tenant_is_demo
  before insert or update of is_demo on public.tenants
  for each row execute function public._guard_tenant_is_demo();

-- ---------------------------------------------------------------------------
-- Marcar / listar cuentas demo
-- ---------------------------------------------------------------------------
create or replace function public.set_tenant_demo_admin(p_tenant_id bigint, p_is_demo boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public._assert_internal_admin();
  update public.tenants set is_demo = coalesce(p_is_demo, false) where id = p_tenant_id;
  if not found then
    raise exception 'tenant_not_found';
  end if;
end;
$$;

create or replace function public.list_demo_tenants_admin()
returns table(id bigint, name text, slug text, plan_id text, owner_email text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public._assert_internal_admin();
  return query
  select t.id, t.name, t.slug, t.plan_id,
    (select u.email::text from public.users_tenants ut
       join public.users u on u.id = ut.user_id
      where ut.tenant_id = t.id
      order by (ut.role = 'owner') desc, ut.id asc limit 1) as owner_email
  from public.tenants t
  where t.is_demo
  order by t.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs existentes: mismo cuerpo + excluir demo
-- ---------------------------------------------------------------------------
create or replace function public.admin_manual_month_totals()
 returns table(collected_usd numeric, new_count integer)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select
    coalesce(sum(ts.amount_usd), 0)::numeric as collected_usd,
    count(*)::int as new_count
  from public.tenant_subscriptions ts
  join public.tenants t on t.id = ts.tenant_id
  where t.stripe_subscription_id is null
    and not t.is_demo
    and date_trunc('month', ts.started_at) = date_trunc('month', now());
$function$;

create or replace function public.admin_manual_paying_rows()
 returns table(tenant_id bigint, plan_id text, amount_usd numeric, cycle text)
 language sql
 security definer
 set search_path to 'public'
as $function$
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
    and not t.is_demo
    and (
      exists (select 1 from public.tenant_subscriptions ts
                where ts.tenant_id = t.id and ts.status = 'active'
                  and ts.expires_at is not null and ts.expires_at > now())
      or (coalesce(t.plan_expired, false) = false
          and (t.plan_expires_at is null or t.plan_expires_at >= now()))
    );
$function$;

create or replace function public.business_metrics_admin()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_now timestamptz := now();
  v_month_start date := date_trunc('month', v_now)::date;
  v_prev_start date := (date_trunc('month', v_now) - interval '1 month')::date;
  v_from timestamptz := date_trunc('month', v_now) - interval '11 months';
  v_elapsed interval := v_now - date_trunc('month', v_now);
  v_prev_cutoff timestamptz := (date_trunc('month', v_now) - interval '1 month') + v_elapsed;
  v_prev_start_ts timestamptz := date_trunc('month', v_now) - interval '1 month';
  result jsonb;
begin
  perform _assert_internal_admin();

  with months as (
    select generate_series(date_trunc('month', v_now) - interval '11 months',
                           date_trunc('month', v_now), interval '1 month')::date as m
  ),
  signups as (
    select date_trunc('month', created_at)::date as m, count(*)::int c
    from tenants where created_at >= v_from and not is_demo group by 1
  ),
  active as (
    select date_trunc('month', o.created_at)::date as m, count(distinct o.tenant_id)::int c
    from orders o join tenants t on t.id = o.tenant_id
    where o.created_at >= v_from and not t.is_demo group by 1
  ),
  signups_prev_td as (
    select count(*)::int c from tenants
    where created_at >= v_prev_start_ts and created_at < v_prev_cutoff and not is_demo
  ),
  active_prev_td as (
    select count(distinct o.tenant_id)::int c from orders o join tenants t on t.id = o.tenant_id
    where o.created_at >= v_prev_start_ts and o.created_at < v_prev_cutoff and not t.is_demo
  ),
  paid as (
    select plan_id from tenants
    where plan_id is not null and plan_id <> 'gratis' and plan_id <> 'enterprise'
      and not is_demo
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
      'prevMonthToDate', coalesce((select c from signups_prev_td),0),
      'series', coalesce((select jsonb_agg(jsonb_build_object('month', mo.m, 'count', coalesce(s.c,0)) order by mo.m)
                          from months mo left join signups s on s.m = mo.m), '[]'::jsonb)
    ),
    'activeMerchants', jsonb_build_object(
      'thisMonth', coalesce((select c from active where m = v_month_start),0),
      'prevMonth', coalesce((select c from active where m = v_prev_start),0),
      'prevMonthToDate', coalesce((select c from active_prev_td),0),
      'series', coalesce((select jsonb_agg(jsonb_build_object('month', mo.m, 'count', coalesce(a.c,0)) order by mo.m)
                          from months mo left join active a on a.m = mo.m), '[]'::jsonb)
    ),
    'planMix', coalesce((select jsonb_agg(jsonb_build_object('planId', plan_id, 'count', c) order by c desc)
                         from (select plan_id, count(*)::int c from paid group by plan_id) pm), '[]'::jsonb),
    'payingCount', (select count(*)::int from paid),
    'demoCount', (select count(*)::int from tenants where is_demo)
  ) into result;

  return result;
end;
$function$;

create or replace function public.get_churn_metrics_admin(p_months integer default 12)
 returns table(month_start timestamp with time zone, active_start integer, churned integer, retained integer, new_reactivated integer, active_end integer, churn_rate numeric)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform public._assert_internal_admin();

  return query
  with bounds as (
    select generate_series(
      date_trunc('month', now()) - ((p_months - 1) || ' months')::interval,
      date_trunc('month', now()),
      interval '1 month'
    )::timestamptz as m
  ),
  subs as (
    select ts.* from public.tenant_subscriptions ts
    join public.tenants t on t.id = ts.tenant_id
    where not t.is_demo
  ),
  snap as (
    select
      b.m,
      coalesce((
        select array_agg(distinct s.tenant_id) from subs s
        where s.started_at <= b.m
          and coalesce(s.expires_at, 'infinity'::timestamptz) > b.m
      ), '{}'::bigint[]) as ids_start,
      coalesce((
        select array_agg(distinct s.tenant_id) from subs s
        where s.started_at <= least(b.m + interval '1 month', now())
          and coalesce(s.expires_at, 'infinity'::timestamptz) > least(b.m + interval '1 month', now())
      ), '{}'::bigint[]) as ids_end
    from bounds b
  )
  select
    s.m,
    cardinality(s.ids_start),
    cardinality(array(select unnest(s.ids_start) except select unnest(s.ids_end))),
    cardinality(array(select unnest(s.ids_start) intersect select unnest(s.ids_end))),
    cardinality(array(select unnest(s.ids_end) except select unnest(s.ids_start))),
    cardinality(s.ids_end),
    case when cardinality(s.ids_start) > 0
      then round(100.0 * cardinality(array(select unnest(s.ids_start) except select unnest(s.ids_end))) / cardinality(s.ids_start), 1)
      else 0 end
  from snap s
  order by s.m asc;
end;
$function$;

create or replace function public.get_revenue_metrics_admin(p_months integer default 12)
 returns table(month_start timestamp with time zone, cash_received numeric, mrr_normalized numeric, arr_projected numeric, active_subs integer, new_subs integer)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform public._assert_internal_admin();

  return query
  with months as (
    select generate_series(
      date_trunc('month', now()) - ((p_months - 1) || ' months')::interval,
      date_trunc('month', now()),
      interval '1 month'
    )::timestamptz as month_start
  ),
  subs as (
    select
      ts.started_at,
      coalesce(ts.expires_at, 'infinity'::timestamptz) as expires_at,
      coalesce(ts.amount_usd, 0) as amount_usd,
      coalesce(ts.amount_usd, 0)
        / case ts.cycle
            when 'monthly' then 1
            when 'quarterly' then 3
            when 'annual' then 12
            else 1
          end as monthly_amount
    from public.tenant_subscriptions ts
    join public.tenants t on t.id = ts.tenant_id
    where not t.is_demo
  )
  select
    m.month_start,
    coalesce((select sum(s.amount_usd) from subs s
      where date_trunc('month', s.started_at) = m.month_start), 0)::numeric,
    coalesce((select sum(s.monthly_amount) from subs s
      where s.started_at <= (m.month_start + interval '1 month' - interval '1 second')
        and s.expires_at >= m.month_start), 0)::numeric,
    (coalesce((select sum(s.monthly_amount) from subs s
      where s.started_at <= (m.month_start + interval '1 month' - interval '1 second')
        and s.expires_at >= m.month_start), 0) * 12)::numeric,
    (select count(*)::int from subs s
      where s.started_at <= (m.month_start + interval '1 month' - interval '1 second')
        and s.expires_at >= m.month_start),
    (select count(*)::int from subs s
      where date_trunc('month', s.started_at) = m.month_start)
  from months m
  order by m.month_start asc;
end;
$function$;

create or replace function public.mrr_movement_admin()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_months date[];
  v_cur date;
  v_prev date;
  v_start numeric;
  v_new numeric;
  v_churned numeric;
  v_expansion numeric;
  v_contraction numeric;
  v_end numeric;
begin
  perform _assert_internal_admin();

  select array_agg(m order by m desc) into v_months
  from (select distinct month_start m from mrr_snapshots
        where tenant_id not in (select id from tenants where is_demo)) s;

  if v_months is null or array_length(v_months, 1) < 2 then
    return jsonb_build_object('ready', false,
      'snapshots', coalesce(array_length(v_months, 1), 0));
  end if;

  v_cur := v_months[1];
  v_prev := v_months[2];

  select
    coalesce(sum(p.mrr_usd), 0),
    coalesce(sum(case when c.tenant_id is null then p.mrr_usd else 0 end), 0)
  into v_start, v_churned
  from mrr_snapshots p
  left join mrr_snapshots c on c.tenant_id = p.tenant_id and c.month_start = v_cur
  where p.month_start = v_prev
    and p.tenant_id not in (select id from tenants where is_demo);

  select coalesce(sum(c.mrr_usd), 0)
  into v_new
  from mrr_snapshots c
  left join mrr_snapshots p on p.tenant_id = c.tenant_id and p.month_start = v_prev
  where c.month_start = v_cur and p.tenant_id is null
    and c.tenant_id not in (select id from tenants where is_demo);

  select
    coalesce(sum(case when c.mrr_usd > p.mrr_usd then c.mrr_usd - p.mrr_usd else 0 end), 0),
    coalesce(sum(case when c.mrr_usd < p.mrr_usd then p.mrr_usd - c.mrr_usd else 0 end), 0)
  into v_expansion, v_contraction
  from mrr_snapshots c
  join mrr_snapshots p on p.tenant_id = c.tenant_id and p.month_start = v_prev
  where c.month_start = v_cur
    and c.tenant_id not in (select id from tenants where is_demo);

  select coalesce(sum(mrr_usd), 0) into v_end from mrr_snapshots
  where month_start = v_cur and tenant_id not in (select id from tenants where is_demo);

  return jsonb_build_object(
    'ready', true,
    'curMonth', v_cur,
    'prevMonth', v_prev,
    'startMrr', round(v_start, 2),
    'newMrr', round(v_new, 2),
    'expansionMrr', round(v_expansion, 2),
    'contractionMrr', round(v_contraction, 2),
    'churnedMrr', round(v_churned, 2),
    'endMrr', round(v_end, 2),
    'nrrPct', case when v_start > 0
      then round(((v_start + v_expansion - v_contraction - v_churned) / v_start) * 100, 1)
      else 0 end
  );
end;
$function$;

create or replace function public.trial_funnel_admin()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_started int;
  v_in_trial int;
  v_converted int;
begin
  perform _assert_internal_admin();

  select count(*)::int into v_started
  from tenants where trial_used_at is not null and not is_demo;

  select count(*)::int into v_in_trial
  from tenants where stripe_subscription_status = 'trialing' and not is_demo;

  select count(*)::int into v_converted
  from tenants
  where trial_used_at is not null and not is_demo
    and stripe_subscription_status in ('active','past_due');

  return jsonb_build_object(
    'started', v_started,
    'inTrial', v_in_trial,
    'converted', v_converted,
    'conversionPct', case when v_started > 0
      then round((v_converted::numeric / v_started) * 100, 1) else 0 end
  );
end;
$function$;

create or replace function public.snapshot_mrr_monthly()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    and not t.is_demo
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
$function$;

create or replace function public.list_paying_clients_admin(p_search text default null::text, p_limit integer default 1000, p_offset integer default 0)
 returns table(tenant_id bigint, tenant_name text, tenant_slug text, tenant_logo text, owner_name text, owner_email text, owner_avatar_url text, tier text, cycle text, started_at timestamp with time zone, expires_at timestamp with time zone, days_until_expiry integer, country_code text, stripe_subscription_status text, total_count bigint)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_term text := nullif(trim(coalesce(p_search, '')), '');
  v_like text := '%' || v_term || '%';
begin
  perform public._assert_internal_admin();
  return query
  with base as (
    select t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
      tec.logo as tenant_logo, owner_data.name as owner_name, owner_data.email as owner_email,
      owner_data.avatar_url as owner_avatar_url, t.plan_id as tier,
      (select ts.cycle from public.tenant_subscriptions ts
        where ts.tenant_id = t.id and ts.status = 'active'
        order by ts.started_at desc limit 1) as cycle,
      t.plan_started_at as started_at, t.plan_expires_at as expires_at,
      case when t.plan_expires_at is null then null
           else extract(day from (t.plan_expires_at - now()))::int end as days_until_expiry,
      t.country_code as country_code, t.stripe_subscription_status as stripe_subscription_status
    from public.tenants t
    left join public.tenant_ecommerce_config tec on tec.tenant_id = t.id
    left join lateral (
      select trim(concat_ws(' ', u.name, u.last_name)) as name, u.email,
        coalesce(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture') as avatar_url
      from public.users_tenants ut
      join public.users u on u.id = ut.user_id
      left join auth.users au on au.id = u.auth_user_id
      where ut.tenant_id = t.id
      order by ut.is_default desc nulls last, (ut.role = 'owner') desc, ut.id asc
      limit 1) owner_data on true
    where t.plan_id in ('basico', 'pro', 'avanzado', 'enterprise')
      and not t.is_demo
      and (exists (select 1 from public.tenant_subscriptions ts
             where ts.tenant_id = t.id and ts.status = 'active'
               and ts.expires_at is not null and ts.expires_at > now())
           or (coalesce(t.stripe_subscription_status, '') <> 'canceled'
               and coalesce(t.plan_expired, false) = false
               and (t.plan_expires_at is null or t.plan_expires_at >= now()))))
  select b.tenant_id, b.tenant_name, b.tenant_slug, b.tenant_logo, b.owner_name,
         b.owner_email, b.owner_avatar_url, b.tier, b.cycle, b.started_at,
         b.expires_at, b.days_until_expiry, b.country_code, b.stripe_subscription_status,
         count(*) over() as total_count
  from base b
  where v_term is null or b.tenant_name ilike v_like or b.tenant_slug ilike v_like
     or b.owner_name ilike v_like or b.owner_email ilike v_like
  order by b.started_at desc nulls last
  limit greatest(coalesce(p_limit, 1000), 0) offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

create or replace function public.list_expired_clients_admin()
 returns table(tenant_id bigint, tenant_name text, tenant_slug text, tenant_logo text, owner_name text, owner_email text, owner_avatar_url text, tier text, cycle text, started_at timestamp with time zone, expires_at timestamp with time zone, days_until_expiry integer, country_code text, stripe_subscription_status text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform public._assert_internal_admin();

  return query
  with last_sub as (
    select distinct on (ts.tenant_id)
      ts.tenant_id, ts.tier, ts.cycle, ts.started_at, ts.expires_at
    from public.tenant_subscriptions ts
    order by ts.tenant_id, ts.started_at desc
  )
  select
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    tec.logo as tenant_logo,
    owner_data.name as owner_name,
    owner_data.email as owner_email,
    owner_data.avatar_url as owner_avatar_url,
    case
      when t.plan_id in ('basico', 'pro', 'avanzado', 'enterprise') then t.plan_id
      else coalesce(t.previous_plan_id, ls.tier)
    end as tier,
    ls.cycle as cycle,
    case
      when t.plan_id in ('basico', 'pro', 'avanzado', 'enterprise') then t.plan_started_at
      else coalesce(ls.started_at, t.plan_started_at)
    end as started_at,
    case
      when t.plan_id in ('basico', 'pro', 'avanzado', 'enterprise') then t.plan_expires_at
      else ls.expires_at
    end as expires_at,
    case
      when t.plan_id in ('basico', 'pro', 'avanzado', 'enterprise') then
        extract(day from (t.plan_expires_at - now()))::int
      when ls.expires_at is null then null
      else extract(day from (ls.expires_at - now()))::int
    end as days_until_expiry,
    t.country_code as country_code,
    t.stripe_subscription_status as stripe_subscription_status
  from public.tenants t
  left join last_sub ls on ls.tenant_id = t.id
  left join public.tenant_ecommerce_config tec on tec.tenant_id = t.id
  left join lateral (
    select
      trim(concat_ws(' ', u.name, u.last_name)) as name,
      u.email,
      coalesce(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture') as avatar_url
    from public.users_tenants ut
    join public.users u on u.id = ut.user_id
    left join auth.users au on au.id = u.auth_user_id
    where ut.tenant_id = t.id
    order by
      ut.is_default desc nulls last,
      (ut.role = 'owner') desc,
      ut.id asc
    limit 1
  ) owner_data on true
  where not t.is_demo
    and (
    (
      t.plan_id in ('basico', 'pro', 'avanzado', 'enterprise')
      and coalesce(t.stripe_subscription_status, '') <> 'past_due'
      and not exists (
        select 1 from public.tenant_subscriptions ts
        where ts.tenant_id = t.id and ts.status = 'active'
          and ts.expires_at is not null and ts.expires_at > now()
      )
      and (
        t.stripe_subscription_status = 'canceled'
        or coalesce(t.plan_expired, false) = true
        or (t.plan_expires_at is not null and t.plan_expires_at < now())
      )
    )
    or
    (
      t.plan_id not in ('basico', 'pro', 'avanzado', 'enterprise')
      and (ls.tenant_id is not null or t.previous_plan_id is not null)
    )
  )
  order by 11 desc nulls last;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Nuevo: conversión registro → pago por día
-- "Convirtió" = el usuario es dueño de al menos un catálogo (no demo) que hoy
-- paga (Stripe active/past_due, o plan manual/IAP vigente) o que apareció en
-- alguna foto mensual de MRR. Los trials que aún no pagan NO cuentan.
-- Días en hora de Venezuela (America/Caracas).
-- ---------------------------------------------------------------------------
create or replace function public.signup_conversion_daily_admin(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tz text := 'America/Caracas';
  v_today date := (now() at time zone 'America/Caracas')::date;
  v_days int := greatest(least(coalesce(p_days, 30), 180), 1);
  result jsonb;
begin
  perform public._assert_internal_admin();

  with days as (
    select generate_series(v_today - (v_days - 1), v_today, interval '1 day')::date as d
  ),
  paid_t as (
    select t.id from tenants t
    where not t.is_demo
      and t.plan_id in ('basico','pro','avanzado','enterprise')
      and (coalesce(t.stripe_subscription_status,'') in ('active','past_due')
           or (t.stripe_subscription_id is null
               and coalesce(t.plan_expired,false) = false
               and (t.plan_expires_at is null or t.plan_expires_at >= now())))
    union
    select s.tenant_id from mrr_snapshots s join tenants t on t.id = s.tenant_id
    where not t.is_demo
  ),
  u as (
    select (u.created_at at time zone v_tz)::date as d,
      exists (select 1 from users_tenants ut join paid_t p on p.id = ut.tenant_id
               where ut.user_id = u.id and ut.role = 'owner') as conv
    from users u
    where u.created_at >= ((v_today - (v_days - 1))::timestamp at time zone v_tz)
      and not exists (select 1 from users_tenants ut join tenants t on t.id = ut.tenant_id
                       where ut.user_id = u.id and t.is_demo)
  ),
  per_day as (
    select days.d, count(u.d)::int as signups,
           count(*) filter (where u.conv)::int as converted
    from days left join u on u.d = days.d
    group by days.d
  )
  select jsonb_build_object(
    'days', v_days,
    'signups', coalesce((select sum(signups) from per_day), 0),
    'converted', coalesce((select sum(converted) from per_day), 0),
    'series', coalesce((select jsonb_agg(jsonb_build_object(
        'day', d, 'signups', signups, 'converted', converted) order by d) from per_day), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nuevo: churn claro por catálogo (desde mrr_snapshots, sin demo)
--   thisMonth: pagaban en la foto del 1° del mes y hoy ya no pagan.
--   lastMonth: estaban en la foto del mes anterior y no en la de este mes.
-- ---------------------------------------------------------------------------
create or replace function public.churn_summary_admin()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cur date := date_trunc('month', now())::date;
  v_prev date := (date_trunc('month', now()) - interval '1 month')::date;
  result jsonb;
begin
  perform public._assert_internal_admin();

  with snap as (
    select s.* from mrr_snapshots s join tenants t on t.id = s.tenant_id where not t.is_demo
  ),
  live as (
    select t.id from tenants t
    where not t.is_demo
      and t.plan_id in ('basico','pro','avanzado','enterprise')
      and (coalesce(t.stripe_subscription_status,'') in ('active','trialing','past_due')
           or (t.stripe_subscription_id is null
               and coalesce(t.plan_expired,false) = false
               and (t.plan_expires_at is null or t.plan_expires_at >= now())))
  ),
  cur as (select * from snap where month_start = v_cur),
  prev as (select * from snap where month_start = v_prev),
  cur_churn as (
    select c.tenant_id, c.plan_id, c.mrr_usd, t.name, t.slug
    from cur c join tenants t on t.id = c.tenant_id
    where c.tenant_id not in (select id from live)
  ),
  prev_churn as (
    select p.tenant_id, p.mrr_usd from prev p
    where p.tenant_id not in (select tenant_id from cur)
  )
  select jsonb_build_object(
    'thisMonth', case when exists (select 1 from cur) then jsonb_build_object(
      'month', v_cur,
      'startCount', (select count(*) from cur),
      'startMrr', (select coalesce(round(sum(mrr_usd), 2), 0) from cur),
      'churnedCount', (select count(*) from cur_churn),
      'lostMrr', (select coalesce(round(sum(mrr_usd), 2), 0) from cur_churn),
      'churnRatePct', case when (select count(*) from cur) > 0
        then round(100.0 * (select count(*) from cur_churn) / (select count(*) from cur), 1) else 0 end,
      'churned', coalesce((select jsonb_agg(jsonb_build_object(
          'tenantId', tenant_id, 'name', name, 'slug', slug, 'planId', plan_id, 'mrrUsd', mrr_usd)
          order by mrr_usd desc, name) from cur_churn), '[]'::jsonb)
    ) else null end,
    'lastMonth', case when exists (select 1 from prev) and exists (select 1 from cur) then jsonb_build_object(
      'month', v_prev,
      'startCount', (select count(*) from prev),
      'churnedCount', (select count(*) from prev_churn),
      'lostMrr', (select coalesce(round(sum(mrr_usd), 2), 0) from prev_churn),
      'churnRatePct', case when (select count(*) from prev) > 0
        then round(100.0 * (select count(*) from prev_churn) / (select count(*) from prev), 1) else 0 end
    ) else null end
  ) into result;

  return result;
end;
$$;

revoke all on function public.set_tenant_demo_admin(bigint, boolean) from anon;
revoke all on function public.list_demo_tenants_admin() from anon;
revoke all on function public.signup_conversion_daily_admin(integer) from anon;
revoke all on function public.churn_summary_admin() from anon;
