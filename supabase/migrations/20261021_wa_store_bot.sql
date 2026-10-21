-- =============================================================================
-- CAT-78 — Bot de WhatsApp para comerciantes (v1).
--
-- El dueño de la tienda escribe al número de AVISOS de la plataforma y gestiona
-- su catálogo por chat (crear/editar productos con fotos, consultar órdenes).
-- Lo atiende la edge `wa-store-bot`; `wa-webhook` le reenvía los mensajes de
-- los números vinculados (o que traen un código de vinculación).
--
--   wa_bot_link_codes  códigos de un solo uso (15 min) que genera el panel.
--   wa_bot_links       teléfono (solo dígitos) ↔ tienda. Un teléfono = una tienda.
--   wa_bot_sessions    memoria corta de la conversación + fotos pendientes.
--   wa_bot_usage       tokens/créditos por turno (para medir costo real).
--
-- Solo la edge (service-role) escribe. El panel lee/borra sus vínculos por RLS.
-- =============================================================================

create table if not exists public.wa_bot_link_codes (
  code          text primary key,
  tenant_id     bigint not null references public.tenants(id) on delete cascade,
  user_id       bigint not null,  -- users.id (sin FK: la tabla users está muy concurrida y el FK bloqueaba el DDL)
  auth_user_id  uuid not null,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);
alter table public.wa_bot_link_codes enable row level security;

create table if not exists public.wa_bot_links (
  id            bigint generated always as identity primary key,
  tenant_id     bigint not null references public.tenants(id) on delete cascade,
  user_id       bigint not null,  -- users.id (sin FK: la tabla users está muy concurrida y el FK bloqueaba el DDL)
  auth_user_id  uuid not null,
  phone         text not null unique,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index if not exists wa_bot_links_tenant_idx on public.wa_bot_links (tenant_id);
alter table public.wa_bot_links enable row level security;

create policy wa_bot_links_select on public.wa_bot_links
  for select to authenticated
  using (tenant_id in (
    select ut.tenant_id from public.users_tenants ut
    join public.users u on u.id = ut.user_id
    where u.auth_user_id = auth.uid()
  ));

create policy wa_bot_links_delete on public.wa_bot_links
  for delete to authenticated
  using (tenant_id in (
    select ut.tenant_id from public.users_tenants ut
    join public.users u on u.id = ut.user_id
    where u.auth_user_id = auth.uid() and ut.role in ('owner', 'admin')
  ));

create table if not exists public.wa_bot_sessions (
  phone          text primary key,
  tenant_id      bigint references public.tenants(id) on delete cascade,
  history        jsonb not null default '[]'::jsonb,
  pending_photos jsonb not null default '[]'::jsonb,
  updated_at     timestamptz not null default now()
);
alter table public.wa_bot_sessions enable row level security;

create table if not exists public.wa_bot_usage (
  id                  bigint generated always as identity primary key,
  tenant_id           bigint references public.tenants(id) on delete cascade,
  phone               text,
  model               text,
  input_tokens        integer not null default 0,
  output_tokens       integer not null default 0,
  cache_read_tokens   integer not null default 0,
  cache_write_tokens  integer not null default 0,
  tool_calls          integer not null default 0,
  credits             integer not null default 0,
  created_at          timestamptz not null default now()
);
create index if not exists wa_bot_usage_tenant_idx on public.wa_bot_usage (tenant_id, created_at desc);
alter table public.wa_bot_usage enable row level security;

-- Fotos que llegan sueltas (varias seguidas, sin texto) se acumulan de forma
-- atómica: cada foto es una invocación distinta de la edge y pueden correr en
-- paralelo. Devuelve cuántas hay pendientes tras agregar.
create or replace function public.wa_bot_push_photo(p_phone text, p_tenant_id bigint, p_url text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.wa_bot_sessions (phone, tenant_id, pending_photos, updated_at)
  values (p_phone, p_tenant_id, jsonb_build_array(p_url), now())
  on conflict (phone) do update
    set pending_photos = case
          when public.wa_bot_sessions.tenant_id is distinct from excluded.tenant_id then excluded.pending_photos
          else public.wa_bot_sessions.pending_photos || excluded.pending_photos
        end,
        tenant_id = excluded.tenant_id,
        updated_at = now()
  returning jsonb_array_length(pending_photos);
$$;
revoke all on function public.wa_bot_push_photo(text, bigint, text) from public, anon, authenticated;

-- v1.1: intentos fallidos de vinculación (límite por teléfono y hora).
create table if not exists public.wa_bot_link_attempts (
  id          bigint generated always as identity primary key,
  phone       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists wa_bot_link_attempts_phone_idx on public.wa_bot_link_attempts (phone, created_at desc);
alter table public.wa_bot_link_attempts enable row level security;

-- v1.2: mensajes que el bot envía (fichas de producto) ↔ producto, para que el
-- dueño pueda responder (citar) una ficha y editar ese producto.
create table if not exists public.wa_bot_msg_refs (
  wamid       text primary key,
  phone       text not null,
  tenant_id   bigint not null references public.tenants(id) on delete cascade,
  product_id  bigint,
  created_at  timestamptz not null default now()
);
alter table public.wa_bot_msg_refs enable row level security;
