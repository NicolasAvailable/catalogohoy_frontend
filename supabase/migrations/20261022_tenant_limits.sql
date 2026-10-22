-- Límites por cliente (tenant_limits).
-- Antes los límites vivían solo en `plans` (productos, variantes, adicionales) y las
-- fotos por producto estaban fijas en el frontend. Ahora:
--   · plans.max_photos: fotos por producto de cada plan (0 = ilimitado).
--   · tenant_limits: una fila por tienda con sus límites efectivos. Se llena con los
--     del plan y se puede editar a mano para un cliente (is_custom = true).
--   · Al cambiar de plan, la fila se re-sincroniza con el plan nuevo. Si es a medida,
--     se queda con el mayor de cada límite (0 = ilimitado gana); si baja a Gratis,
--     vuelve a los límites del plan y deja de ser a medida.
--   · Al editar un plan, se re-sincronizan las tiendas de ese plan que no son a medida.
-- Seguridad: los miembros solo LEEN su fila; nadie escribe desde el cliente (los
-- tenants sí son editables por sus miembros, por eso los límites van en tabla aparte).

alter table public.plans add column if not exists max_photos integer not null default 3;
update public.plans set max_photos = case id
  when 'gratis' then 3 when 'basico' then 10 when 'pro' then 20
  when 'avanzado' then 50 when 'enterprise' then 0 else max_photos end;

create table if not exists public.tenant_limits (
  tenant_id    bigint primary key references public.tenants(id) on delete cascade,
  max_products integer not null,
  max_photos   integer not null,
  max_variants integer not null,
  max_addons   integer not null,
  is_custom    boolean not null default false,
  note         text,
  updated_at   timestamptz not null default now()
);

alter table public.tenant_limits enable row level security;

drop policy if exists tenant_limits_select_member on public.tenant_limits;
create policy tenant_limits_select_member on public.tenant_limits
  for select to authenticated
  using (public._is_service_or_member(tenant_id));

-- 0 = ilimitado: gana siempre; si no, el mayor.
create or replace function public._limit_max(a integer, b integer)
returns integer language sql immutable as $$
  select case when coalesce(a, 0) = 0 or coalesce(b, 0) = 0 then 0 else greatest(a, b) end
$$;

create or replace function public.sync_tenant_limits(p_tenant_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_plan public.plans%rowtype;
  v_cur  public.tenant_limits%rowtype;
begin
  select p.* into v_plan
  from public.plans p join public.tenants t on t.plan_id = p.id
  where t.id = p_tenant_id;
  if not found then return; end if;

  select * into v_cur from public.tenant_limits where tenant_id = p_tenant_id;

  if found and v_cur.is_custom and not coalesce(v_plan.is_free, false) then
    update public.tenant_limits set
      max_products = public._limit_max(v_cur.max_products, v_plan.max_products),
      max_photos   = public._limit_max(v_cur.max_photos,   v_plan.max_photos),
      max_variants = public._limit_max(v_cur.max_variants, v_plan.max_variants),
      max_addons   = public._limit_max(v_cur.max_addons,   v_plan.max_addons),
      updated_at   = now()
    where tenant_id = p_tenant_id;
  else
    insert into public.tenant_limits as tl
      (tenant_id, max_products, max_photos, max_variants, max_addons, is_custom, updated_at)
    values (p_tenant_id, v_plan.max_products, v_plan.max_photos, v_plan.max_variants,
            v_plan.max_addons, false, now())
    on conflict (tenant_id) do update set
      max_products = excluded.max_products,
      max_photos   = excluded.max_photos,
      max_variants = excluded.max_variants,
      max_addons   = excluded.max_addons,
      is_custom    = false,
      updated_at   = now();
  end if;
end;
$$;

revoke all on function public.sync_tenant_limits(bigint) from public, anon, authenticated;

create or replace function public.trg_tenants_sync_limits()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.sync_tenant_limits(new.id);
  return new;
end;
$$;

drop trigger if exists trg_tenants_sync_limits on public.tenants;
create trigger trg_tenants_sync_limits
  after insert or update of plan_id on public.tenants
  for each row
  execute function public.trg_tenants_sync_limits();

create or replace function public.trg_plans_sync_limits()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  update public.tenant_limits tl set
    max_products = new.max_products,
    max_photos   = new.max_photos,
    max_variants = new.max_variants,
    max_addons   = new.max_addons,
    updated_at   = now()
  from public.tenants t
  where t.id = tl.tenant_id and t.plan_id = new.id and not tl.is_custom;
  return new;
end;
$$;

drop trigger if exists trg_plans_sync_limits on public.plans;
create trigger trg_plans_sync_limits
  after update of max_products, max_photos, max_variants, max_addons on public.plans
  for each row execute function public.trg_plans_sync_limits();

-- Límite de productos: ahora sale de tenant_limits (con el plan como respaldo).
create or replace function public.check_product_limit()
returns trigger
language plpgsql
as $function$
declare
  v_max_products integer;
  v_current_count integer;
  v_plan_name text;
begin
  select coalesce(tl.max_products, p.max_products), p.name
    into v_max_products, v_plan_name
  from public.tenants t
  join public.plans p on p.id = t.plan_id
  left join public.tenant_limits tl on tl.tenant_id = t.id
  where t.id = new.tenant_id;

  -- NULL o <= 0 = ilimitado (misma convención que el frontend).
  if v_max_products is null or v_max_products <= 0 then
    return new;
  end if;

  select count(*) into v_current_count
  from public.products
  where tenant_id = new.tenant_id;

  if v_current_count >= v_max_products then
    raise exception 'PLAN_LIMIT_EXCEEDED:Has alcanzado el límite de % productos de tu plan %. Actualiza tu plan para agregar más productos.',
      v_max_products, v_plan_name;
  end if;

  return new;
end;
$function$;

-- Backfill: todas las tiendas con los límites de su plan…
insert into public.tenant_limits (tenant_id, max_products, max_photos, max_variants, max_addons)
select t.id, p.max_products, p.max_photos, p.max_variants, p.max_addons
from public.tenants t join public.plans p on p.id = t.plan_id
on conflict (tenant_id) do nothing;

-- …menos L-Gante Store (acuerdo 2026-10-22: Básico anual con 50 fotos y 20 variantes).
update public.tenant_limits
set max_photos = 50, max_variants = 20, is_custom = true,
    note = 'Acuerdo 2026-10-22 (TikTok): Básico anual con 50 fotos y 20 variantes', updated_at = now()
where tenant_id = 3797;
