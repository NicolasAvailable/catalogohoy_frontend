-- 2026-10-21 · Email de bienvenida al crear la cuenta (edge fn send-welcome-email).
-- Se dispara cuando la cuenta queda confirmada:
--   - signup por email: UPDATE email_confirmed_at null → set (al validar el código)
--   - Google/OAuth: INSERT con email_confirmed_at ya seteado
-- Nunca rompe el signup (exception → return new). Idempotencia en la función
-- vía users.welcome_email_sent_at.

alter table public.users add column if not exists welcome_email_sent_at timestamptz;

-- Secret del webhook en Vault (se genera acá, no queda en el repo).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'welcome_email_webhook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'welcome_email_webhook_secret');
  end if;
end $$;

create or replace function public.send_welcome_email_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'welcome_email_webhook_secret' limit 1;

  perform net.http_post(
    url := 'https://yvkurjivijnhliofmfmj.supabase.co/functions/v1/send-welcome-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object('auth_user_id', new.id)
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed_send_welcome on auth.users;
create trigger on_auth_user_confirmed_send_welcome
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.send_welcome_email_on_confirm();

drop trigger if exists on_auth_user_created_send_welcome on auth.users;
create trigger on_auth_user_created_send_welcome
  after insert on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function public.send_welcome_email_on_confirm();
