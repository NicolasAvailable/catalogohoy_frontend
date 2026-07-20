-- product_backups: snapshots de los productos de un tenant para poder restaurar
-- antes/después de una importación de Excel (el cliente re-sube su lista con
-- precios nuevos; guardamos un respaldo por seguridad). RLS por miembro del
-- tenant (mismo patrón que whatsapp_notification_settings). El snapshot es un
-- jsonb con cada producto (sin columnas internas) + los nombres de sus
-- categorías — suficiente para descargar a Excel o re-aplicar por upsert.

create table if not exists public.product_backups (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid,
  reason text not null default 'import',
  product_count integer not null default 0,
  snapshot jsonb not null default '[]'::jsonb
);

create index if not exists product_backups_tenant_created_idx
  on public.product_backups (tenant_id, created_at desc);

alter table public.product_backups enable row level security;

drop policy if exists product_backups_member_all on public.product_backups;
create policy product_backups_member_all on public.product_backups
  for all
  using (
    exists (
      select 1 from public.users_tenants ut
      join public.users u on u.id = ut.user_id
      where ut.tenant_id = product_backups.tenant_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users_tenants ut
      join public.users u on u.id = ut.user_id
      where ut.tenant_id = product_backups.tenant_id
        and u.auth_user_id = auth.uid()
    )
  );

-- Crea un backup snapshot de los productos del tenant. SECURITY DEFINER para
-- leer todos los productos del tenant; verifica que el caller sea miembro.
-- Mantiene solo los últimos 20 backups por tenant.
create or replace function public.create_product_backup(
  p_tenant_id bigint,
  p_reason text default 'import'
) returns bigint
  language plpgsql
  security definer
  set search_path to public
as $$
declare
  v_backup_id bigint;
  v_snapshot jsonb;
  v_count integer;
begin
  if not exists (
    select 1 from public.users_tenants ut
    join public.users u on u.id = ut.user_id
    where ut.tenant_id = p_tenant_id and u.auth_user_id = auth.uid()
  ) then
    raise exception 'not a member of tenant %', p_tenant_id using errcode = '42501';
  end if;

  select
    coalesce(jsonb_agg(
      (to_jsonb(p) - 'search_blob' - 'tenant_id' - 'auth_user_id')
      || jsonb_build_object('categories', (
           select coalesce(jsonb_agg(c.name order by c.name), '[]'::jsonb)
           from public.product_categories pc
           join public.categories c on c.id = pc.category_id
           where pc.product_id = p.id
         ))
      order by p.position, p.id
    ), '[]'::jsonb),
    count(*)
  into v_snapshot, v_count
  from public.products p
  where p.tenant_id = p_tenant_id;

  insert into public.product_backups (tenant_id, created_by, reason, product_count, snapshot)
  values (p_tenant_id, auth.uid(), coalesce(nullif(p_reason, ''), 'import'), v_count, v_snapshot)
  returning id into v_backup_id;

  delete from public.product_backups
  where tenant_id = p_tenant_id
    and id not in (
      select id from public.product_backups
      where tenant_id = p_tenant_id
      order by created_at desc
      limit 20
    );

  return v_backup_id;
end;
$$;

grant execute on function public.create_product_backup(bigint, text) to authenticated;
