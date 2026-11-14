-- Cobranza automática: aviso ANTES de vencer + avisos diarios (pedido de Saúl, 2026-11-14).
-- Calendario: remind_before_days antes de la fecha de pago, el día que vence y
-- después cada every_days (ahora se permite 1 = todos los días) hasta que pague.
-- start_after_days pasa a ser el "plazo para pagar" de las órdenes sin cuotas.
-- Aditivo: columna nueva con default y check más amplio.

alter table public.customer_reminder_settings
  add column if not exists remind_before_days integer not null default 2;
alter table public.customer_reminder_settings
  drop constraint if exists customer_reminder_settings_remind_before_days_check;
alter table public.customer_reminder_settings
  add constraint customer_reminder_settings_remind_before_days_check check (remind_before_days between 0 and 7);

alter table public.customer_reminder_settings
  drop constraint if exists customer_reminder_settings_every_days_check;
alter table public.customer_reminder_settings
  add constraint customer_reminder_settings_every_days_check check (every_days between 1 and 60);

-- Estado: agrega remind_before_days.
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
    'addon_active',       coalesce(v_addon.active_until > now(), false),
    'active_until',       v_addon.active_until,
    'billing',            v_addon.billing,
    'enabled',            coalesce(v_set.enabled, false),
    'start_after_days',   coalesce(v_set.start_after_days, 3),
    'every_days',         coalesce(v_set.every_days, 7),
    'remind_before_days', coalesce(v_set.remind_before_days, 2),
    'optouts',            (select count(*) from public.customer_reminder_optouts o where o.tenant_id = p_tenant_id),
    'sent_30d',           (select count(*) from public.whatsapp_notification_logs l
                            where l.tenant_id = p_tenant_id and l.template_type = 'credit_reminder_auto'
                              and l.status = 'sent' and l.created_at > now() - interval '30 days'),
    'last_sent_at',       (select max(l.created_at) from public.whatsapp_notification_logs l
                            where l.tenant_id = p_tenant_id and l.template_type = 'credit_reminder_auto'
                              and l.status = 'sent'),
    'customers_owing',    (select count(distinct regexp_replace(o.phone, '\D', '', 'g'))
                             from public.orders o
                            where o.tenant_id = p_tenant_id and o.status = 'credit'
                              and length(regexp_replace(coalesce(o.phone, ''), '\D', '', 'g')) >= 8)
  );
end;
$$;

-- Guardar: firma nueva con p_remind_before_days (la vieja se elimina).
drop function if exists public.customer_reminders_save(bigint, boolean, integer, integer);
create or replace function public.customer_reminders_save(
  p_tenant_id bigint, p_enabled boolean, p_start_after_days integer, p_every_days integer,
  p_remind_before_days integer default 2
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
    (tenant_id, enabled, start_after_days, every_days, remind_before_days, updated_at)
  values (p_tenant_id, coalesce(p_enabled, false),
          least(greatest(coalesce(p_start_after_days, 3), 0), 90),
          least(greatest(coalesce(p_every_days, 7), 1), 60),
          least(greatest(coalesce(p_remind_before_days, 2), 0), 7), now())
  on conflict (tenant_id) do update set
    enabled = excluded.enabled,
    start_after_days = excluded.start_after_days,
    every_days = excluded.every_days,
    remind_before_days = excluded.remind_before_days,
    updated_at = now();
end;
$$;
revoke all on function public.customer_reminders_save(bigint, boolean, integer, integer, integer) from public, anon;
grant execute on function public.customer_reminders_save(bigint, boolean, integer, integer, integer) to authenticated;

notify pgrst, 'reload schema';
