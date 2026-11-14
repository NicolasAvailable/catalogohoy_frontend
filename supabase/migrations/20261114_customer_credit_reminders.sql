-- Cobranza automática por WhatsApp al CLIENTE FINAL (pedido de Saúl, Motofox).
--
-- Complemento PAGO ($7/mes o $70/año): Meta cobra cada plantilla UTILITY que
-- sale del número de avisos de la plataforma (~$0,009 c/u). Lo que ya existía
-- y sigue gratis: el botón manual "Recordatorio de cobro" por orden
-- (send-order-action) y el email/push de cobranza AL DUEÑO (send-credit-reminders).
--
-- Piezas (todo aditivo):
--   1) tenant_addons: complementos comprados por tienda (active_until). Solo
--      se escribe por service_role / panel interno (admin_set_tenant_addon).
--   2) customer_reminder_settings: config de la tienda (encendido, desde
--      cuántos días de deuda, cada cuántos días). Se escribe por RPC (owner/admin).
--   3) customer_reminder_optouts: clientes que tocaron "No recibir más
--      recordatorios" (lo inserta wa-webhook). Nunca se les vuelve a escribir.
--   4) orders.customer_reminded_at: anti-spam por cliente (cada N días).
--   5) RPCs para el front y el panel interno + cron diario 13:00 UTC (9 a.m. VE).
-- Regla del proyecto: tablas públicas nuevas con RLS en la misma migración.

-- 1) Complementos -------------------------------------------------------------
create table if not exists public.tenant_addons (
  tenant_id    bigint not null references public.tenants(id) on delete cascade,
  addon        text   not null check (addon in ('wa_credit_reminders')),
  active_until timestamptz not null,
  billing      text   not null default 'manual' check (billing in ('monthly', 'annual', 'manual')),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, addon)
);
alter table public.tenant_addons enable row level security;
drop policy if exists tenant_addons_select_member on public.tenant_addons;
create policy tenant_addons_select_member on public.tenant_addons
  for select to authenticated using (public._is_service_or_member(tenant_id));

-- 2) Configuración de la tienda ---------------------------------------------------
create table if not exists public.customer_reminder_settings (
  tenant_id        bigint primary key references public.tenants(id) on delete cascade,
  enabled          boolean not null default false,
  start_after_days integer not null default 3  check (start_after_days between 0 and 90),
  every_days       integer not null default 7  check (every_days between 2 and 60),
  updated_at       timestamptz not null default now()
);
alter table public.customer_reminder_settings enable row level security;
drop policy if exists customer_reminder_settings_select_member on public.customer_reminder_settings;
create policy customer_reminder_settings_select_member on public.customer_reminder_settings
  for select to authenticated using (public._is_service_or_member(tenant_id));

-- 3) Bajas de clientes ------------------------------------------------------------
create table if not exists public.customer_reminder_optouts (
  tenant_id  bigint not null references public.tenants(id) on delete cascade,
  phone      text   not null,           -- solo dígitos, E.164 sin '+'
  created_at timestamptz not null default now(),
  primary key (tenant_id, phone)
);
alter table public.customer_reminder_optouts enable row level security;
drop policy if exists customer_reminder_optouts_select_member on public.customer_reminder_optouts;
create policy customer_reminder_optouts_select_member on public.customer_reminder_optouts
  for select to authenticated using (public._is_service_or_member(tenant_id));

-- 4) Anti-spam por orden ----------------------------------------------------------
alter table public.orders add column if not exists customer_reminded_at timestamptz;
comment on column public.orders.customer_reminded_at is
  'Último recordatorio AUTOMÁTICO por WhatsApp al cliente final (send-customer-credit-reminders).';

-- 5a) Estado para Perfil → Notificaciones (cualquier miembro lo lee) --------------
create or replace function public.customer_reminders_status(p_tenant_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_addon public.tenant_addons%rowtype;
  v_set   public.customer_reminder_settings%rowtype;
begin
  if not public._is_service_or_member(p_tenant_id) then
    raise exception 'forbidden';
  end if;
  select * into v_addon from public.tenant_addons
   where tenant_id = p_tenant_id and addon = 'wa_credit_reminders';
  select * into v_set from public.customer_reminder_settings where tenant_id = p_tenant_id;

  return jsonb_build_object(
    'addon_active',     coalesce(v_addon.active_until > now(), false),
    'active_until',     v_addon.active_until,
    'billing',          v_addon.billing,
    'enabled',          coalesce(v_set.enabled, false),
    'start_after_days', coalesce(v_set.start_after_days, 3),
    'every_days',       coalesce(v_set.every_days, 7),
    'optouts',          (select count(*) from public.customer_reminder_optouts o where o.tenant_id = p_tenant_id),
    'sent_30d',         (select count(*) from public.whatsapp_notification_logs l
                          where l.tenant_id = p_tenant_id and l.template_type = 'credit_reminder_auto'
                            and l.status = 'sent' and l.created_at > now() - interval '30 days'),
    'last_sent_at',     (select max(l.created_at) from public.whatsapp_notification_logs l
                          where l.tenant_id = p_tenant_id and l.template_type = 'credit_reminder_auto'
                            and l.status = 'sent'),
    'customers_owing',  (select count(distinct regexp_replace(o.phone, '\D', '', 'g'))
                           from public.orders o
                          where o.tenant_id = p_tenant_id and o.status = 'credit'
                            and length(regexp_replace(coalesce(o.phone, ''), '\D', '', 'g')) >= 8)
  );
end;
$$;
revoke all on function public.customer_reminders_status(bigint) from public, anon;
grant execute on function public.customer_reminders_status(bigint) to authenticated, service_role;

-- 5b) Guardar config (solo owner/admin; encender exige el complemento activo) ------
create or replace function public.customer_reminders_save(
  p_tenant_id bigint, p_enabled boolean, p_start_after_days integer, p_every_days integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.api_tenant_admin_user(p_tenant_id) is null then
    raise exception 'forbidden';
  end if;
  if coalesce(p_enabled, false) and not exists (
    select 1 from public.tenant_addons
     where tenant_id = p_tenant_id and addon = 'wa_credit_reminders' and active_until > now()
  ) then
    raise exception 'addon_required';
  end if;
  insert into public.customer_reminder_settings as s
    (tenant_id, enabled, start_after_days, every_days, updated_at)
  values (p_tenant_id, coalesce(p_enabled, false),
          least(greatest(coalesce(p_start_after_days, 3), 0), 90),
          least(greatest(coalesce(p_every_days, 7), 2), 60), now())
  on conflict (tenant_id) do update set
    enabled = excluded.enabled,
    start_after_days = excluded.start_after_days,
    every_days = excluded.every_days,
    updated_at = now();
end;
$$;
revoke all on function public.customer_reminders_save(bigint, boolean, integer, integer) from public, anon;
grant execute on function public.customer_reminders_save(bigint, boolean, integer, integer) to authenticated;

-- 5c) Panel interno: activar / extender / apagar el complemento -------------------
-- p_months > 0 suma meses desde hoy (o desde el vencimiento si sigue vigente);
-- p_months = 0 lo apaga ya. billing: 'monthly' | 'annual' | 'manual'.
create or replace function public.admin_set_tenant_addon(
  p_tenant_id bigint, p_addon text, p_months integer, p_billing text default 'manual', p_note text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur   timestamptz;
  v_until timestamptz;
begin
  perform public._assert_internal_admin();
  select active_until into v_cur from public.tenant_addons
   where tenant_id = p_tenant_id and addon = p_addon;
  if coalesce(p_months, 0) <= 0 then
    v_until := now();
  else
    v_until := greatest(coalesce(v_cur, now()), now()) + make_interval(months => p_months);
  end if;
  insert into public.tenant_addons as a (tenant_id, addon, active_until, billing, note, updated_at)
  values (p_tenant_id, p_addon, v_until, coalesce(p_billing, 'manual'), p_note, now())
  on conflict (tenant_id, addon) do update set
    active_until = excluded.active_until,
    billing = excluded.billing,
    note = coalesce(excluded.note, a.note),
    updated_at = now();
  -- Al apagar el complemento se apaga también el envío.
  if v_until <= now() then
    update public.customer_reminder_settings set enabled = false, updated_at = now()
     where tenant_id = p_tenant_id;
  end if;
  return v_until;
end;
$$;
revoke all on function public.admin_set_tenant_addon(bigint, text, integer, text, text) from public, anon;
grant execute on function public.admin_set_tenant_addon(bigint, text, integer, text, text) to authenticated;

-- 5d) Panel interno: leer los complementos + uso de un catálogo --------------------
create or replace function public.admin_get_tenant_addons(p_tenant_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._assert_internal_admin();
  return jsonb_build_object(
    'addons', coalesce((select jsonb_agg(jsonb_build_object(
        'addon', a.addon, 'active_until', a.active_until, 'billing', a.billing, 'note', a.note,
        'active', a.active_until > now()))
      from public.tenant_addons a where a.tenant_id = p_tenant_id), '[]'::jsonb),
    'reminders_enabled', coalesce((select s.enabled from public.customer_reminder_settings s
                                    where s.tenant_id = p_tenant_id), false),
    'reminders_sent_30d', (select count(*) from public.whatsapp_notification_logs l
                            where l.tenant_id = p_tenant_id and l.template_type = 'credit_reminder_auto'
                              and l.status = 'sent' and l.created_at > now() - interval '30 days')
  );
end;
$$;
revoke all on function public.admin_get_tenant_addons(bigint) from public, anon;
grant execute on function public.admin_get_tenant_addons(bigint) to authenticated;

-- 6) Cron diario: 13:00 UTC = 9 a.m. Venezuela -------------------------------------
-- Se agenda DESPUÉS de deployar la edge function send-customer-credit-reminders.
select cron.unschedule('send-customer-credit-reminders-daily')
where exists (select 1 from cron.job where jobname = 'send-customer-credit-reminders-daily');

select cron.schedule(
  'send-customer-credit-reminders-daily',
  '0 13 * * *',
  $cron$
  select net.http_post(
    url := 'https://yvkurjivijnhliofmfmj.supabase.co/functions/v1/send-customer-credit-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'whsec_custcredit_7a437d98b1cc5a8c5e39d35ba78bf462'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
