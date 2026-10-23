-- Panel interno · Bot de WhatsApp: una fila por número (conectado o que lo usó)
-- con tienda, plan, usuario, actividad (7/30 días/total), créditos, costo IA y saldo.
create or replace function public.wa_bot_admin_stats()
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v json;
begin
  if coalesce(auth.jwt() ->> 'email', '') not in ('nicaso3006@gmail.com') then
    raise exception 'not authorized';
  end if;
  select json_build_object(
    'links', coalesce((select json_agg(l) from (
      select k.id, k.tenant_id, t.name as tenant_name, k.phone, u.name as user_name, u.email as user_email,
             k.created_at, k.last_used_at
      from wa_bot_links k left join tenants t on t.id = k.tenant_id left join users u on u.id = k.user_id
      order by k.last_used_at desc nulls last) l), '[]'::json),
    'today', (select json_build_object('messages', count(*), 'credits', coalesce(sum(credits),0),
        'cost_usd', round(coalesce(sum(input_tokens*2 + output_tokens*10 + cache_read_tokens*0.2 + cache_write_tokens*2.5),0)/1e6, 4))
      from wa_bot_usage where created_at >= date_trunc('day', now() at time zone 'America/Caracas') at time zone 'America/Caracas'),
    'last_30d', coalesce((select json_agg(d order by d.day) from (
      select to_char(date_trunc('day', created_at at time zone 'America/Caracas'), 'YYYY-MM-DD') as day,
             count(*)::int as messages, sum(credits)::int as credits,
             round(sum(input_tokens*2 + output_tokens*10 + cache_read_tokens*0.2 + cache_write_tokens*2.5)/1e6, 4) as cost_usd
      from wa_bot_usage where created_at >= now() - interval '30 days'
      group by 1) d), '[]'::json),
    'by_tenant', coalesce((select json_agg(b) from (
      select w.tenant_id, t.name as tenant_name, count(*)::int as messages, sum(w.credits)::int as credits,
             round(sum(w.input_tokens*2 + w.output_tokens*10 + w.cache_read_tokens*0.2 + w.cache_write_tokens*2.5)/1e6, 4) as cost_usd,
             max(w.created_at) as last_at
      from wa_bot_usage w left join tenants t on t.id = w.tenant_id
      group by w.tenant_id, t.name order by count(*) desc) b), '[]'::json),
    'users', coalesce((select json_agg(x order by x.last_at desc nulls last) from (
      with phones as (
        select tenant_id, phone from wa_bot_links
        union
        select tenant_id, phone from wa_bot_usage
      ), usage as (
        select tenant_id, phone,
               count(*)::int as messages_total,
               (count(*) filter (where created_at >= now() - interval '7 days'))::int as messages_7d,
               (count(*) filter (where created_at >= now() - interval '30 days'))::int as messages_30d,
               coalesce(sum(credits),0)::int as credits_total,
               coalesce(sum(credits) filter (where created_at >= now() - interval '30 days'),0)::int as credits_30d,
               round(sum(input_tokens*2 + output_tokens*10 + cache_read_tokens*0.2 + cache_write_tokens*2.5)/1e6, 4) as cost_total,
               round(coalesce(sum(input_tokens*2 + output_tokens*10 + cache_read_tokens*0.2 + cache_write_tokens*2.5)
                 filter (where created_at >= now() - interval '30 days'),0)/1e6, 4) as cost_30d,
               min(created_at) as first_at, max(created_at) as last_at
        from wa_bot_usage group by tenant_id, phone
      ), errs as (
        select tenant_id, phone, count(*)::int as errors_7d from wa_bot_messages
        where role = 'system' and debug ? 'error' and created_at >= now() - interval '7 days'
        group by tenant_id, phone
      )
      select p.tenant_id, t.name as tenant_name, t.slug as tenant_slug, pl.name as plan_name, p.phone,
             k.id is not null as connected, k.created_at as linked_at,
             u.name as user_name, u.email as user_email,
             coalesce(us.messages_total,0) as messages_total, coalesce(us.messages_7d,0) as messages_7d,
             coalesce(us.messages_30d,0) as messages_30d, coalesce(us.credits_total,0) as credits_total,
             coalesce(us.credits_30d,0) as credits_30d, coalesce(us.cost_total,0) as cost_total,
             coalesce(us.cost_30d,0) as cost_30d, us.first_at, us.last_at,
             coalesce(e.errors_7d,0) as errors_7d,
             (select coalesce(c.monthly_balance,0) + coalesce(c.purchased_balance,0) from ai_credits c where c.user_id = k.user_id) as credit_balance
      from phones p
      left join wa_bot_links k on k.phone = p.phone and k.tenant_id = p.tenant_id
      left join tenants t on t.id = p.tenant_id
      left join plans pl on pl.id = t.plan_id
      left join users u on u.id = k.user_id
      left join usage us on us.tenant_id = p.tenant_id and us.phone = p.phone
      left join errs e on e.tenant_id = p.tenant_id and e.phone = p.phone) x), '[]'::json),
    'errors_7d', (select count(*) from wa_bot_messages where role = 'system' and debug ? 'error' and created_at >= now() - interval '7 days')
  ) into v;
  return v;
end $function$;
