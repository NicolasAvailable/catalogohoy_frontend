-- =============================================================================
-- API pública de CatalogoHoy (tokens por tienda) — 2026-11-05
--
-- Cada tienda puede crear tokens de acceso (Ajustes → API) para que software
-- externo (p. ej. agentes de IA como "Work by Agents") gestione SU catálogo.
--   * El token se muestra una sola vez; en la DB solo queda su hash SHA-256.
--   * Scopes por área (products/orders/customers/settings/expenses × read/write).
--   * Revocable, con vencimiento opcional. Máx. 10 tokens activos por tienda.
--   * Solo owner/admin de la tienda puede crear, ver y revocar tokens.
--   * La edge `public-api` valida el token con service_role y filtra TODO por
--     el tenant del token (nunca acepta tenant_id del cliente).
-- Tablas con RLS activado y sin policies: solo service_role las lee directo;
-- el panel usa las RPCs SECURITY DEFINER de abajo (chequean owner/admin).
-- =============================================================================

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  created_by bigint not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  prefix text not null,
  token_hash text not null unique,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);
create index if not exists api_tokens_tenant_idx on public.api_tokens (tenant_id);
alter table public.api_tokens enable row level security;

create table if not exists public.api_request_log (
  id bigint generated always as identity primary key,
  token_id uuid references public.api_tokens(id) on delete cascade,
  tenant_id bigint references public.tenants(id) on delete cascade,
  method text,
  tool text,
  status int not null,
  error text,
  duration_ms int,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists api_request_log_token_time_idx on public.api_request_log (token_id, created_at desc);
create index if not exists api_request_log_tenant_time_idx on public.api_request_log (tenant_id, created_at desc);
alter table public.api_request_log enable row level security;

revoke all on public.api_tokens from anon, authenticated;
revoke all on public.api_request_log from anon, authenticated;

-- ¿El usuario logueado es owner/admin de la tienda? Devuelve su users.id o null.
create or replace function public.api_tenant_admin_user(p_tenant_id bigint)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select u.id from public.users u
  join public.users_tenants ut on ut.user_id = u.id
  where u.auth_user_id = auth.uid()
    and ut.tenant_id = p_tenant_id
    and ut.role in ('owner', 'admin')
  limit 1;
$$;
revoke all on function public.api_tenant_admin_user(bigint) from public, anon, authenticated;

create or replace function public.api_tokens_list(p_tenant_id bigint)
returns table (
  id uuid, name text, prefix text, scopes text[], created_at timestamptz,
  last_used_at timestamptz, expires_at timestamptz, revoked_at timestamptz, created_by_email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.api_tenant_admin_user(p_tenant_id) is null then
    raise exception 'forbidden';
  end if;
  return query
    select t.id, t.name, t.prefix, t.scopes, t.created_at, t.last_used_at, t.expires_at, t.revoked_at, u.email::text
    from public.api_tokens t
    left join public.users u on u.id = t.created_by
    where t.tenant_id = p_tenant_id
    order by t.revoked_at nulls first, t.created_at desc;
end;
$$;

create or replace function public.api_token_create(
  p_tenant_id bigint, p_name text, p_scopes text[], p_expires_days int
)
returns table (id uuid, token text)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_user bigint := public.api_tenant_admin_user(p_tenant_id);
  v_allowed text[] := array[
    'products:read', 'products:write', 'orders:read', 'orders:write', 'customers:read',
    'settings:read', 'settings:write', 'expenses:read', 'expenses:write'
  ];
  v_scopes text[];
  v_token text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'forbidden';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;
  select coalesce(array_agg(distinct s order by s), '{}') into v_scopes
    from unnest(p_scopes) s where s = any (v_allowed);
  if cardinality(v_scopes) = 0 then
    raise exception 'scopes_required';
  end if;
  if (select count(*) from public.api_tokens t
      where t.tenant_id = p_tenant_id and t.revoked_at is null
        and (t.expires_at is null or t.expires_at > now())) >= 10 then
    raise exception 'too_many_tokens';
  end if;

  v_token := 'cht_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.api_tokens (tenant_id, created_by, name, prefix, token_hash, scopes, expires_at)
  values (
    p_tenant_id, v_user, left(trim(p_name), 60), left(v_token, 12),
    encode(extensions.digest(v_token, 'sha256'), 'hex'), v_scopes,
    case when coalesce(p_expires_days, 0) > 0 then now() + make_interval(days => p_expires_days) end
  )
  returning api_tokens.id into v_id;

  return query select v_id, v_token;
end;
$$;

create or replace function public.api_token_revoke(p_token_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_tenant bigint;
begin
  select t.tenant_id into v_tenant from public.api_tokens t where t.id = p_token_id;
  if v_tenant is null or public.api_tenant_admin_user(v_tenant) is null then
    raise exception 'forbidden';
  end if;
  update public.api_tokens set revoked_at = now() where id = p_token_id and revoked_at is null;
  return true;
end;
$$;

create or replace function public.api_request_log_list(p_tenant_id bigint, p_limit int)
returns table (
  id bigint, token_name text, method text, tool text, status int, error text,
  duration_ms int, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.api_tenant_admin_user(p_tenant_id) is null then
    raise exception 'forbidden';
  end if;
  return query
    select l.id, t.name, l.method, l.tool, l.status, l.error, l.duration_ms, l.created_at
    from public.api_request_log l
    left join public.api_tokens t on t.id = l.token_id
    where l.tenant_id = p_tenant_id
    order by l.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke all on function public.api_tokens_list(bigint) from public, anon;
revoke all on function public.api_token_create(bigint, text, text[], int) from public, anon;
revoke all on function public.api_token_revoke(uuid) from public, anon;
revoke all on function public.api_request_log_list(bigint, int) from public, anon;
grant execute on function public.api_tokens_list(bigint) to authenticated;
grant execute on function public.api_token_create(bigint, text, text[], int) to authenticated;
grant execute on function public.api_token_revoke(uuid) to authenticated;
grant execute on function public.api_request_log_list(bigint, int) to authenticated;
