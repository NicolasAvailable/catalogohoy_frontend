-- Newsletter de novedades (CAT-97, 2026-11-02).
-- Mensual (día 1: todo lo del mes) y semanal (domingos: lo nuevo y arreglos
-- de la semana). Se escribe/aprueba/envía desde el panel interno (Newsletter)
-- y lo manda la edge `send-newsletter` por SES. Nada sale a clientes sin
-- status = 'approved'.

create table if not exists public.newsletter_issues (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('monthly', 'weekly')),
  period_start date not null,
  period_end date not null,
  subject text not null,
  title text not null,
  intro text not null default '',
  -- [{ "emoji": "📱", "title": "…", "items": [{ "title": "…", "text": "…" }] }]
  sections jsonb not null default '[]'::jsonb,
  outro text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'sending', 'sent', 'cancelled')),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, period_start)
);
alter table public.newsletter_issues enable row level security;
revoke all on public.newsletter_issues from anon, authenticated;

-- Bajas: quien se da de baja no recibe más newsletters (sí los correos de su
-- tienda: órdenes, reportes, cobros).
create table if not exists public.newsletter_unsubscribes (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.newsletter_unsubscribes enable row level security;
revoke all on public.newsletter_unsubscribes from anon, authenticated;

-- Audiencia de un número: dueños/miembros de tienda con correo, registrados en
-- 120 días o activos en 60 (o de pago), sin rebotes duros ni quejas, sin baja
-- y que aún no lo recibieron (marketing_sends, campaign = 'newsletter_<id>').
create or replace function public.newsletter_audience(p_campaign text)
returns table (user_id bigint, name text, email text, store text)
language sql
security definer
set search_path = public
as $$
  with base as (
    select u.id, u.name, lower(trim(u.email)) as email, u.created_at,
      (select t.name from users_tenants ut join tenants t on t.id = ut.tenant_id
        where ut.user_id = u.id order by ut.is_default desc nulls last, ut.id limit 1) as store,
      exists (select 1 from users_tenants ut join tenants t on t.id = ut.tenant_id
        where ut.user_id = u.id and coalesce(t.plan_id, 'gratis') <> 'gratis' and not coalesce(t.plan_expired, false)) as paid,
      greatest(
        au.last_sign_in_at,
        (select max(o.created_at) from users_tenants ut join orders o on o.tenant_id = ut.tenant_id where ut.user_id = u.id),
        (select max(p.created_at) from users_tenants ut join products p on p.tenant_id = ut.tenant_id where ut.user_id = u.id)
      ) as act
    from users u
    left join auth.users au on au.id = u.auth_user_id
    where u.email is not null and trim(u.email) <> ''
  )
  select distinct on (b.email) b.id, b.name, b.email, b.store
  from base b
  where b.store is not null
    and (b.paid or b.created_at > now() - interval '120 days' or b.act > now() - interval '60 days')
    and not exists (select 1 from newsletter_unsubscribes x where x.email = b.email)
    and not exists (
      select 1 from ses_email_events e
      where lower(e.recipient) = b.email
        and (e.complained_at is not null or (e.bounced_at is not null and e.bounce_type = 'Permanent'))
    )
    and not exists (
      select 1 from marketing_sends s
      where s.campaign = p_campaign and s.channel = 'email' and (s.user_id = b.id or lower(s.recipient) = b.email)
    )
  order by b.email, b.id;
$$;
revoke execute on function public.newsletter_audience(text) from public, anon, authenticated;

-- --- Panel interno (gated a admin interno) ----------------------------------

create or replace function public.newsletter_admin_list()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_internal_admin();
  return json_build_object(
    'issues', coalesce((select json_agg(x order by x.period_start desc, x.id desc) from (
      select i.*,
        (select count(*) from marketing_sends s where s.campaign = 'newsletter_' || i.id and s.status = 'sent')::int as sent_count,
        (select count(*) from marketing_sends s where s.campaign = 'newsletter_' || i.id and s.status <> 'sent')::int as failed_count
      from newsletter_issues i) x), '[]'::json),
    'unsubscribes', (select count(*) from newsletter_unsubscribes)::int
  );
end;
$$;

-- Crea (id null) o actualiza un número. Un número enviado ya no se edita.
create or replace function public.newsletter_admin_save(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint := nullif(p ->> 'id', '')::bigint;
begin
  perform public._assert_internal_admin();
  if v_id is null then
    insert into newsletter_issues (kind, period_start, period_end, subject, title, intro, sections, outro)
    values (p ->> 'kind', (p ->> 'period_start')::date, (p ->> 'period_end')::date,
      p ->> 'subject', p ->> 'title', coalesce(p ->> 'intro', ''),
      coalesce(p -> 'sections', '[]'::jsonb), coalesce(p ->> 'outro', ''))
    returning id into v_id;
  else
    update newsletter_issues set
      kind = coalesce(p ->> 'kind', kind),
      period_start = coalesce((p ->> 'period_start')::date, period_start),
      period_end = coalesce((p ->> 'period_end')::date, period_end),
      subject = coalesce(p ->> 'subject', subject),
      title = coalesce(p ->> 'title', title),
      intro = coalesce(p ->> 'intro', intro),
      sections = coalesce(p -> 'sections', sections),
      outro = coalesce(p ->> 'outro', outro),
      -- editar un número aprobado lo devuelve a borrador
      status = 'draft',
      approved_at = null,
      updated_at = now()
    where id = v_id and status in ('draft', 'approved');
    if not found then raise exception 'El número no existe o ya se envió'; end if;
  end if;
  return v_id;
end;
$$;

-- draft ↔ approved, o cancelled. 'sending'/'sent' los pone la edge al enviar.
create or replace function public.newsletter_admin_set_status(p_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_internal_admin();
  if p_status not in ('draft', 'approved', 'cancelled') then
    raise exception 'Estado no permitido';
  end if;
  update newsletter_issues
    set status = p_status,
        approved_at = case when p_status = 'approved' then now() else null end,
        updated_at = now()
  where id = p_id and status in ('draft', 'approved', 'cancelled');
  if not found then raise exception 'El número no existe o ya se está enviando'; end if;
end;
$$;

revoke execute on function public.newsletter_admin_list() from public, anon;
revoke execute on function public.newsletter_admin_save(jsonb) from public, anon;
revoke execute on function public.newsletter_admin_set_status(bigint, text) from public, anon;
grant execute on function public.newsletter_admin_list() to authenticated;
grant execute on function public.newsletter_admin_save(jsonb) to authenticated;
grant execute on function public.newsletter_admin_set_status(bigint, text) to authenticated;
