-- Envíos de campañas de marketing de la plataforma (anuncio del Asistente
-- WhatsApp, 2026-10-22). Una fila por (campaña, canal, usuario) para no
-- repetir envíos si el lote se corta. Solo service_role (edge wa-assistant-launch).
create table if not exists public.marketing_sends (
  id bigint generated always as identity primary key,
  campaign text not null,
  channel text not null check (channel in ('whatsapp', 'email')),
  user_id bigint not null references public.users(id) on delete cascade,
  recipient text not null,
  status text not null default 'sent',
  message_id text,
  error text,
  created_at timestamptz not null default now(),
  unique (campaign, channel, user_id)
);
alter table public.marketing_sends enable row level security;
revoke all on public.marketing_sends from anon, authenticated;

-- Audiencia del anuncio. whatsapp: dueños con teléfono de tiendas de pago, o
-- registrados este mes que ya subieron productos (Nicolas: bajar el costo).
-- email: registrados en 60 días o activos en 30, sin rebotes duros ni quejas.
-- "Activo" = último login, última orden o último producto creado en su tienda.
create or replace function public.marketing_launch_audience(p_campaign text, p_channel text)
returns table (user_id bigint, name text, email text, phone text, store text)
language sql
security definer
set search_path = public
as $$
  with base as (
    select u.id, u.name, u.email, u.created_at,
      regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') as ph,
      (select t.name from users_tenants ut join tenants t on t.id = ut.tenant_id
        where ut.user_id = u.id order by ut.is_default desc nulls last, ut.id limit 1) as store,
      exists (select 1 from users_tenants ut join tenants t on t.id = ut.tenant_id
        where ut.user_id = u.id and coalesce(t.plan_id, 'gratis') <> 'gratis' and not coalesce(t.plan_expired, false)) as paid,
      exists (select 1 from users_tenants ut join products p on p.tenant_id = ut.tenant_id where ut.user_id = u.id) as has_products,
      greatest(
        au.last_sign_in_at,
        (select max(o.created_at) from users_tenants ut join orders o on o.tenant_id = ut.tenant_id where ut.user_id = u.id),
        (select max(p.created_at) from users_tenants ut join products p on p.tenant_id = ut.tenant_id where ut.user_id = u.id)
      ) as act
    from users u
    left join auth.users au on au.id = u.auth_user_id
  )
  select b.id, b.name, b.email, b.ph, b.store
  from base b
  where not exists (
      select 1 from marketing_sends s
      where s.campaign = p_campaign and s.channel = p_channel and s.user_id = b.id
    )
    and case p_channel
      when 'whatsapp' then length(b.ph) between 10 and 15
        and (b.paid or (b.created_at >= date_trunc('month', now()) and b.has_products))
      when 'email' then b.email is not null
        and (b.created_at > now() - interval '60 days' or b.act > now() - interval '30 days')
        and not exists (
          select 1 from ses_email_events e
          where lower(e.recipient) = lower(b.email)
            and (e.complained_at is not null or (e.bounced_at is not null and e.bounce_type = 'Permanent'))
        )
      else false
    end
  order by b.id;
$$;
revoke execute on function public.marketing_launch_audience(text, text) from public, anon, authenticated;
