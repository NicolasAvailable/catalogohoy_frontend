-- Registro de conversaciones del asistente de WhatsApp (CAT-78) para el panel
-- "Asistente WhatsApp": qué escribió el dueño, qué respondió el bot, qué
-- acciones hizo y cuántos créditos gastó. Solo se lee desde la edge
-- `wa-store-bot` con service role (RLS sin políticas públicas).
create table if not exists public.wa_bot_messages (
  id bigint generated always as identity primary key,
  tenant_id bigint not null,
  phone text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  body text not null default '',
  media jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  credits integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists wa_bot_messages_tenant_created_idx
  on public.wa_bot_messages (tenant_id, created_at desc);

alter table public.wa_bot_messages enable row level security;

-- Detalle técnico por mensaje (modelo, tokens, costo USD, herramientas con
-- entrada/salida, errores). Solo lo ve el panel interno.
alter table public.wa_bot_messages add column if not exists debug jsonb;

-- Panel interno (app internal → Bot de WhatsApp). Gateadas por email como
-- ai_usage_stats_admin.
create or replace function public.wa_bot_admin_stats()
returns json language plpgsql security definer set search_path to 'public' as $$
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
    'errors_7d', (select count(*) from wa_bot_messages where role = 'system' and debug ? 'error' and created_at >= now() - interval '7 days')
  ) into v;
  return v;
end $$;

create or replace function public.wa_bot_admin_messages(p_tenant_id bigint default null, p_phone text default null, p_before bigint default null, p_limit int default 100)
returns setof public.wa_bot_messages language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') not in ('nicaso3006@gmail.com') then
    raise exception 'not authorized';
  end if;
  return query select * from wa_bot_messages m
    where (p_tenant_id is null or m.tenant_id = p_tenant_id)
      and (p_phone is null or m.phone = p_phone)
      and (p_before is null or m.id < p_before)
    order by m.id desc limit least(coalesce(p_limit, 100), 300);
end $$;

revoke all on function public.wa_bot_admin_stats() from anon;
revoke all on function public.wa_bot_admin_messages(bigint, text, bigint, int) from anon;
