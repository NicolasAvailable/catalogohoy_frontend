-- Cambio de slug del catálogo desde el admin.
-- Historial en tenant_slug_changes + RPC change_tenant_slug con límite de
-- 2 cambios por cada 30 días (ventana rodante). La tabla solo se escribe
-- desde la RPC (security definer); los miembros del tenant pueden leerla
-- para mostrar cuántos cambios quedan.
-- Aplicada en prod el 2026-07-08 vía MCP (apply_migration tenant_slug_change).

create table public.tenant_slug_changes (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  old_slug text not null,
  new_slug text not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index tenant_slug_changes_tenant_idx
  on public.tenant_slug_changes (tenant_id, changed_at desc);

alter table public.tenant_slug_changes enable row level security;

create policy tenant_slug_changes_member_read
  on public.tenant_slug_changes for select
  using (
    exists (
      select 1
      from public.users_tenants ut
      join public.users u on u.id = ut.user_id
      where ut.tenant_id = tenant_slug_changes.tenant_id
        and u.auth_user_id = auth.uid()
    )
  );

create or replace function public.change_tenant_slug(p_tenant_id bigint, p_new_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_old_slug text;
  v_new_slug text;
  v_recent_changes int;
  v_is_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Solo el owner puede cambiar la URL del catálogo.
  select exists (
    select 1
    from users_tenants ut
    join users u on u.id = ut.user_id
    where ut.tenant_id = p_tenant_id
      and u.auth_user_id = auth.uid()
      and ut.role = 'owner'
  ) into v_is_owner;

  if not v_is_owner then
    raise exception 'not_authorized';
  end if;

  v_new_slug := lower(trim(p_new_slug));

  if v_new_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or length(v_new_slug) < 3
     or length(v_new_slug) > 40 then
    raise exception 'invalid_slug';
  end if;

  -- Subdominios del sistema / rutas públicas que no pueden ser slugs.
  if v_new_slug in (
    'www','api','app','auth','admin','mail','blog','help','ayuda','docs',
    'landing','internal','static','cdn','status','dev','test','staging',
    'soporte','support','checkout','order','product','pago','pagos','cuenta'
  ) then
    raise exception 'reserved_slug';
  end if;

  select slug into v_old_slug from tenants where id = p_tenant_id for update;
  if not found then
    raise exception 'tenant_not_found';
  end if;

  if v_new_slug = v_old_slug then
    raise exception 'same_slug';
  end if;

  select count(*) into v_recent_changes
  from tenant_slug_changes
  where tenant_id = p_tenant_id
    and changed_at > now() - interval '30 days';

  if v_recent_changes >= 2 then
    raise exception 'limit_reached';
  end if;

  if exists (select 1 from tenants where slug = v_new_slug) then
    raise exception 'slug_taken';
  end if;

  update tenants set slug = v_new_slug, updated_at = now() where id = p_tenant_id;

  insert into tenant_slug_changes (tenant_id, old_slug, new_slug, changed_by)
  values (p_tenant_id, v_old_slug, v_new_slug, auth.uid());

  return jsonb_build_object('slug', v_new_slug, 'remaining', 1 - v_recent_changes);
exception
  when unique_violation then
    raise exception 'slug_taken';
end $fn$;

revoke all on function public.change_tenant_slug(bigint, text) from public;
revoke all on function public.change_tenant_slug(bigint, text) from anon;
grant execute on function public.change_tenant_slug(bigint, text) to authenticated;
