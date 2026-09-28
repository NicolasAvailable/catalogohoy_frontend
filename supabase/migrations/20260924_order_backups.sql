-- order_backups: snapshots de las órdenes de un tenant para dar seguridad al
-- cliente. A diferencia de product_backups, el import de órdenes NO es
-- destructivo (arma una orden nueva), así que el respaldo se crea a demanda
-- ("Crear respaldo ahora") y antes de restaurar. Restaurar es APPEND-ONLY:
-- re-inserta solo las órdenes del snapshot cuyo order_number ya no existe
-- (borradas), sin pisar ni borrar las actuales. RLS por miembro del tenant
-- (mismo patrón que product_backups).

create table if not exists public.order_backups (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid,
  reason text not null default 'manual',
  order_count integer not null default 0,
  snapshot jsonb not null default '[]'::jsonb
);

create index if not exists order_backups_tenant_created_idx
  on public.order_backups (tenant_id, created_at desc);

alter table public.order_backups enable row level security;

drop policy if exists order_backups_member_all on public.order_backups;
create policy order_backups_member_all on public.order_backups
  for all
  using (
    exists (
      select 1 from public.users_tenants ut
      join public.users u on u.id = ut.user_id
      where ut.tenant_id = order_backups.tenant_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users_tenants ut
      join public.users u on u.id = ut.user_id
      where ut.tenant_id = order_backups.tenant_id
        and u.auth_user_id = auth.uid()
    )
  );

-- Crea un snapshot de TODAS las órdenes del tenant. SECURITY DEFINER para leer
-- todas las órdenes; verifica que el caller sea miembro. Mantiene los últimos 20.
create or replace function public.create_order_backup(
  p_tenant_id bigint,
  p_reason text default 'manual'
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
    coalesce(jsonb_agg(to_jsonb(o) order by o.order_number, o.id), '[]'::jsonb),
    count(*)
  into v_snapshot, v_count
  from public.orders o
  where o.tenant_id = p_tenant_id;

  insert into public.order_backups (tenant_id, created_by, reason, order_count, snapshot)
  values (p_tenant_id, auth.uid(), coalesce(nullif(p_reason, ''), 'manual'), v_count, v_snapshot)
  returning id into v_backup_id;

  delete from public.order_backups
  where tenant_id = p_tenant_id
    and id not in (
      select id from public.order_backups
      where tenant_id = p_tenant_id
      order by created_at desc
      limit 20
    );

  return v_backup_id;
end;
$$;

grant execute on function public.create_order_backup(bigint, text) to authenticated;

-- Restaura APPEND-ONLY: re-inserta solo las órdenes del snapshot cuyo
-- order_number ya no existe en el tenant (fueron borradas). NO toca ni pisa las
-- actuales. Deshabilita los triggers de USUARIO de `orders` mientras repone los
-- registros históricos (postgres es dueño de la tabla, así que puede; es
-- transaccional → un rollback los re-habilita solo) para no disparar los 8
-- triggers de INSERT (notificaciones/push/WhatsApp/Meta CAPI/chat/límite/
-- descuento/cliente ni el de numeración). Los triggers de FK (system) se
-- conservan. `overriding system value` preserva el id y el número originales.
-- NOTA: no se usa `session_replication_role = replica` porque el owner
-- (postgres) no tiene permiso para setearlo en Supabase (error 42501).
-- Devuelve cuántas órdenes se recuperaron.
create or replace function public.restore_order_backup(p_backup_id bigint)
  returns integer
  language plpgsql
  security definer
  set search_path to public
as $$
declare
  v_tenant_id bigint;
  v_snapshot jsonb;
  v_elem jsonb;
  v_restored integer := 0;
begin
  select tenant_id, snapshot into v_tenant_id, v_snapshot
  from public.order_backups where id = p_backup_id;

  if v_tenant_id is null then
    raise exception 'backup % not found', p_backup_id using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.users_tenants ut
    join public.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and u.auth_user_id = auth.uid()
  ) then
    raise exception 'not a member of tenant %', v_tenant_id using errcode = '42501';
  end if;

  alter table public.orders disable trigger user;

  for v_elem in select * from jsonb_array_elements(v_snapshot)
  loop
    if (v_elem->>'order_number') is not null
       and not exists (
         select 1 from public.orders o
         where o.tenant_id = v_tenant_id
           and o.order_number = (v_elem->>'order_number')::int
       ) then
      insert into public.orders overriding system value
      select (jsonb_populate_record(null::public.orders, v_elem)).*;
      v_restored := v_restored + 1;
    end if;
  end loop;

  alter table public.orders enable trigger user;

  return v_restored;
end;
$$;

grant execute on function public.restore_order_backup(bigint) to authenticated;
