-- ============================================================================
-- Conexión de Meta Business por OAuth (CAT-64 catálogo + CAT-65 pixel).
-- Fase 1 (conexión) + Fase 2 (Commerce Catalog + feed). Ya aplicada a prod vía
-- MCP; este archivo la deja versionada en el repo.
--
-- Modelo de seguridad: tokens SERVER-ONLY. RLS habilitado SIN policies → el
-- cliente jamás lee la tabla; todo acceso pasa por las edge functions
-- (service role: meta-oauth, meta-catalog, meta-catalog-feed) o por los RPC
-- SECURITY DEFINER de abajo, que validan membresía y nunca devuelven tokens.
--
-- metadata (jsonb):
--   - scopes:     scopes otorgados en el OAuth
--   - businesses: [{id, name}] — todos los Business del usuario (selector)
--   - feed_id:    product feed del Commerce Catalog (ingesta diaria + on-demand)
-- ============================================================================

create table if not exists public.meta_business_connections (
  tenant_id         bigint primary key references public.tenants(id) on delete cascade,
  access_token      text not null,
  token_expires_at  timestamptz,
  business_id       text,
  business_name     text,
  catalog_id        text,
  pixel_id          text,
  system_user_token text,
  status            text not null default 'connected',
  metadata          jsonb not null default '{}'::jsonb,
  connected_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.meta_business_connections enable row level security;
-- (sin policies a propósito: acceso solo server-side)

-- Estado de la conexión para el panel — sin exponer tokens. v2: incluye la
-- lista de Businesses (id+name) para el selector cuando el usuario tiene varios.
create or replace function public.get_meta_connection_status(p_tenant_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v jsonb;
begin
  if not exists (
    select 1 from users u join users_tenants ut on ut.user_id = u.id
    where u.auth_user_id = auth.uid() and ut.tenant_id = p_tenant_id
  ) then
    return jsonb_build_object('connected', false);
  end if;
  select jsonb_build_object(
    'connected',    (c.status = 'connected'),
    'business_id',  c.business_id,
    'business_name',c.business_name,
    'catalog_id',   c.catalog_id,
    'pixel_id',     c.pixel_id,
    'connected_at', c.connected_at,
    'expires_at',   c.token_expires_at,
    'businesses',   coalesce(c.metadata->'businesses', '[]'::jsonb)
  ) into v
  from meta_business_connections c where c.tenant_id = p_tenant_id;
  return coalesce(v, jsonb_build_object('connected', false));
end $function$;

-- Desconectar: borra la conexión local (el catálogo/pixel siguen existiendo en
-- Meta; reconectar los re-vincula por catalog_id/pixel_id si se re-aprovisiona).
create or replace function public.disconnect_meta(p_tenant_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from users u join users_tenants ut on ut.user_id = u.id
    where u.auth_user_id = auth.uid() and ut.tenant_id = p_tenant_id
  ) then
    raise exception 'forbidden';
  end if;
  delete from meta_business_connections where tenant_id = p_tenant_id;
end $function$;
