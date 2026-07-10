-- Idioma por defecto del catálogo público (es/en/fr/pt) — aplicada en prod
-- 2026-07-09. Columna default_language en tenant_ecommerce_config + agregada
-- al SELECT estático de get_public_catalog (gotcha conocida). CAT-9.
-- (Definición completa de la RPC: ver historial de migraciones en Supabase,
--  migración "default_language_catalogo".)
alter table public.tenant_ecommerce_config
  add column if not exists default_language text not null default 'es';
