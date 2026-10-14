-- Config de versiones de la app móvil para el modal de actualización in-app.
-- El cliente nativo compara su versionCode/build con estos valores:
--   build < min_build    → actualización OBLIGATORIA (modal no cerrable)
--   build < latest_build → actualización OPCIONAL (modal cerrable)
-- title/message son opcionales: si están, se muestran tal cual (permite un
-- mensaje custom por release, ej. "actualización crítica"); si no, el cliente
-- usa textos por defecto (i18n).
create table if not exists public.mobile_app_config (
  platform      text primary key check (platform in ('android','ios')),
  latest_build  integer not null,
  min_build     integer not null default 1,
  latest_version text,
  store_url     text not null,
  update_title   text,
  update_message text,
  updated_at    timestamptz not null default now()
);

alter table public.mobile_app_config enable row level security;

-- Lectura pública (anon + authenticated): el chequeo corre incluso antes del
-- login; no hay nada sensible acá.
drop policy if exists "mobile_app_config public read" on public.mobile_app_config;
create policy "mobile_app_config public read"
  on public.mobile_app_config for select
  to anon, authenticated
  using (true);

insert into public.mobile_app_config (platform, latest_build, min_build, latest_version, store_url) values
  ('android', 14, 1, '1.0.10', 'https://play.google.com/store/apps/details?id=com.catalogohoy.app'),
  ('ios',     10, 1, '1.0',    'https://apps.apple.com/app/id6817059692')
on conflict (platform) do nothing;
