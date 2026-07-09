-- Cuentas nuevas sin fila en tenant_ecommerce_config: el editor de catálogo
-- hace UPDATE ... eq(tenant_id) sobre 0 filas → PostgREST no da error → toast
-- de "guardado" sin guardar nada (bug reportado 2026-07-09, cliente potencial
-- perdido). Se siembra la fila al crear el tenant y se backfillean los
-- existentes (backfill aplicado en prod: 1485/1485 tenants con config).

create or replace function public.seed_tenant_ecommerce_config()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into tenant_ecommerce_config (tenant_id)
  values (new.id)
  on conflict (tenant_id) do nothing;
  return new;
exception when others then
  -- Defensivo: sembrar la config nunca debe bloquear la creación del tenant.
  return new;
end $$;

drop trigger if exists trg_seed_ecommerce_config on public.tenants;
create trigger trg_seed_ecommerce_config
after insert on public.tenants
for each row execute function public.seed_tenant_ecommerce_config();

-- Backfill: todos los tenants existentes sin fila de config
insert into tenant_ecommerce_config (tenant_id)
select t.id from tenants t
where not exists (select 1 from tenant_ecommerce_config c where c.tenant_id = t.id);
