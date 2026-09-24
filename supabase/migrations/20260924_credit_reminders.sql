-- CAT-79 — Recordatorios de cobranza para órdenes a crédito.
--
-- Aditivo, sin riesgo. Dos piezas:
--   1) Columnas: plan de cuotas por orden + anti-spam del cron + preferencias
--      por usuario (patrón notify_low_stock / low_stock_threshold).
--   2) Cron diario que invoca la edge function send-credit-reminders (misma
--      mecánica net.http_post + x-webhook-secret que send-low-stock-alerts).
--
-- NOTA: credit_installments NO es un ledger de abonos. Es el plan de cuotas
-- acordado ([{"dueDate":"2026-10-02","amount":105.25,"paid":false}, ...]):
-- `amount` es opcional y `paid` se marca a mano desde el editor de la orden.
-- La orden está "vencida" si tiene alguna cuota impaga con dueDate pasada;
-- sin cuotas, si su antigüedad supera users.credit_reminder_days del dueño.

-- 1) Columnas -----------------------------------------------------------------

alter table public.orders
  add column if not exists credit_installments jsonb,
  add column if not exists credit_reminded_at timestamptz;

comment on column public.orders.credit_installments is
  'Plan de cuotas de órdenes a crédito: [{dueDate, amount?, paid?}]. No es un ledger de abonos.';
comment on column public.orders.credit_reminded_at is
  'Última vez que la orden entró en un email de cobranza (anti-spam del cron send-credit-reminders).';

alter table public.users
  add column if not exists notify_credit_reminders boolean not null default true,
  add column if not exists credit_reminder_days integer not null default 7;

comment on column public.users.notify_credit_reminders is
  'Perfil → Notificaciones: recordatorios de cobranza de órdenes a crédito (opt-out).';
comment on column public.users.credit_reminder_days is
  'Umbral de días sin cobrar para avisar cuando la orden a crédito no tiene cuotas.';

-- 2) RPC get_my_profile_with_tenants ------------------------------------------
-- El RPC arma el objeto 'user' con claves ESTÁTICAS (mismo drift que
-- get_public_catalog): toda columna nueva de preferencias hay que sumarla ahí.
-- Aplicado por MCP (migración credit_reminders_profile_rpc): se agregaron
--   'notify_credit_reminders', u.notify_credit_reminders,
--   'credit_reminder_days',  u.credit_reminder_days
-- al jsonb_build_object del bloque 'user'.

-- 3) Cron diario --------------------------------------------------------------
-- Se agenda DESPUÉS de deployar la edge function (aplicado por MCP en el mismo
-- deploy). 12:00 UTC = 08:00 Venezuela.

select cron.unschedule('send-credit-reminders-daily')
where exists (select 1 from cron.job where jobname = 'send-credit-reminders-daily');

select cron.schedule(
  'send-credit-reminders-daily',
  '0 12 * * *',
  $cron$
  select net.http_post(
    url := 'https://yvkurjivijnhliofmfmj.supabase.co/functions/v1/send-credit-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'whsec_credit_5d1c9a7e3b8f2064ca97e1b4d6f08a23'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $cron$
);
