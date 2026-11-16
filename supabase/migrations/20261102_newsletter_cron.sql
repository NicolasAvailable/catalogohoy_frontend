-- Newsletter: borradores automáticos (CAT-97). Aplicar DESPUÉS de deployar la
-- edge `send-newsletter`. Los crons solo arman el BORRADOR y le mandan una
-- prueba a Nicolas; enviar a las tiendas sigue siendo Aprobar + Enviar en el
-- panel interno.

-- Secret del cron en el Vault (se genera acá, nunca en el repo).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'newsletter_cron_secret') then
    perform vault.create_secret(encode(gen_random_bytes(24), 'hex'), 'newsletter_cron_secret');
  end if;
end $$;

create or replace function public._newsletter_cron_secret()
returns text
language sql
stable security definer
set search_path to ''
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'newsletter_cron_secret' limit 1;
$$;
revoke all on function public._newsletter_cron_secret() from public, anon, authenticated;
grant execute on function public._newsletter_cron_secret() to service_role;

select cron.unschedule(jobname) from cron.job
where jobname in ('newsletter-weekly-draft', 'newsletter-monthly-draft');

-- Domingos 12:00 UTC = 08:00 Venezuela: semana lunes→domingo.
select cron.schedule(
  'newsletter-weekly-draft',
  '0 12 * * 0',
  $cron$
  select net.http_post(
    url := 'https://yvkurjivijnhliofmfmj.supabase.co/functions/v1/send-newsletter',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'newsletter_cron_secret')
    ),
    body := '{"action":"auto_draft","kind":"weekly"}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $cron$
);

-- Día 1 a las 12:00 UTC: el mes anterior completo.
select cron.schedule(
  'newsletter-monthly-draft',
  '0 12 1 * *',
  $cron$
  select net.http_post(
    url := 'https://yvkurjivijnhliofmfmj.supabase.co/functions/v1/send-newsletter',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'newsletter_cron_secret')
    ),
    body := '{"action":"auto_draft","kind":"monthly"}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $cron$
);
