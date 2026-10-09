-- Snapshot mensual de MRR por tenant → permite medir movimiento de MRR
-- (new/expansion/contraction/churn) y NRR hacia adelante. El MRR por plan usa
-- precio de lista (el KPI de MRR exacto sigue saliendo de la edge fn Stripe);
-- acá importa la granularidad por tenant/plan para el movimiento.
-- El cron mensual se programa aparte:
--   select cron.schedule('snapshot-mrr-monthly', '0 6 1 * *',
--     $$select public.snapshot_mrr_monthly();$$);
create table if not exists public.mrr_snapshots (
  month_start date not null,
  tenant_id bigint not null,
  plan_id text not null,
  mrr_usd numeric(12,2) not null default 0,
  captured_at timestamptz not null default now(),
  primary key (month_start, tenant_id)
);

-- Captura (upsert) el MRR del mes en curso para cada catálogo pago.
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
    (case t.plan_id
       when 'basico' then 11.99
       when 'pro' then 19.99
       when 'avanzado' then 29.99
       when 'enterprise' then 99.99
       else 0 end)
    + coalesce(t.extra_catalogs, 0) * 4.99
  from tenants t
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

-- Movimiento de MRR entre los dos snapshots más recientes + NRR.
create or replace function public.mrr_movement_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  from (select distinct month_start m from mrr_snapshots) s;

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
  where p.month_start = v_prev;

  select coalesce(sum(c.mrr_usd), 0)
  into v_new
  from mrr_snapshots c
  left join mrr_snapshots p on p.tenant_id = c.tenant_id and p.month_start = v_prev
  where c.month_start = v_cur and p.tenant_id is null;

  select
    coalesce(sum(case when c.mrr_usd > p.mrr_usd then c.mrr_usd - p.mrr_usd else 0 end), 0),
    coalesce(sum(case when c.mrr_usd < p.mrr_usd then p.mrr_usd - c.mrr_usd else 0 end), 0)
  into v_expansion, v_contraction
  from mrr_snapshots c
  join mrr_snapshots p on p.tenant_id = c.tenant_id and p.month_start = v_prev
  where c.month_start = v_cur;

  select coalesce(sum(mrr_usd), 0) into v_end from mrr_snapshots where month_start = v_cur;

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
$$;

grant execute on function public.mrr_movement_admin() to authenticated;
