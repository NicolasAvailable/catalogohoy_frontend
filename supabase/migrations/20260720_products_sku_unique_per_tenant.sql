-- El índice único de SKU era GLOBAL entre tenants: dos tiendas distintas no
-- podían usar el mismo SKU (ej. importar el Excel de otro catálogo daba
-- "duplicate key products_sku_unique" aunque el producto no existiera en la
-- tienda). La unicidad correcta en multi-tenant es POR TENANT.
--
-- Seguro: la unicidad global es más estricta que la por-tenant, así que ningún
-- dato existente puede violar el índice nuevo. Nadie depende de la unicidad
-- global (único lookup por sku en el código es tenant-scoped; en DB solo
-- products_search_blob lo concatena para búsqueda).

drop index if exists public.products_sku_unique;

create unique index if not exists products_sku_unique_per_tenant
  on public.products (tenant_id, sku)
  where sku is not null;
