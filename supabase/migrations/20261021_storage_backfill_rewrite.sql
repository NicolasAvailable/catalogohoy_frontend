-- =============================================================================
-- CAT-88 — Reescritura de URLs supabase.co → cdn.catalogohoy.com.
--
-- Solo reescribe URLs cuyo objeto ya está copiado en S3 (`storage_backfill`
-- con status 'done'). Antes de tocar cada fila guarda el valor viejo en
-- `storage_url_backup` → `storage_backfill_rollback_urls()` lo restaura.
-- Re-ejecutable: solo toca filas que todavía tengan URLs de supabase.co.
--
-- No se tocan `orders.products` (snapshot histórico; además orders tiene un
-- trigger ON UPDATE que manda WhatsApp). Esas URLs siguen sirviéndose de
-- Supabase hasta la fase 3.
-- =============================================================================

create table if not exists public.storage_url_backup (
  tbl        text not null,
  row_id     text not null,
  col        text not null,
  old_value  jsonb,
  created_at timestamptz not null default now(),
  primary key (tbl, row_id, col)
);
alter table public.storage_url_backup enable row level security;

-- URL vieja → URL del CDN si el objeto ya está en S3; si no, la deja igual.
create or replace function public.storage_cdn_url(u text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when u like 'https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/%'
     and exists (
       select 1 from public.storage_backfill b
        where b.status = 'done'
          and b.key = substr(u, length('https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/') + 1)
     )
    then 'https://cdn.catalogohoy.com/' ||
         substr(u, length('https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/') + 1)
    else u
  end;
$$;

-- Igual para un jsonb: reemplaza cada URL de storage que encuentre adentro.
create or replace function public.storage_cdn_jsonb(j jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  t text := j::text;
  m text;
begin
  if j is null then return null; end if;
  for m in
    select distinct (regexp_matches(t,
      'https://yvkurjivijnhliofmfmj\.supabase\.co/storage/v1/object/public/catalogohoy/[^"\\]+', 'g'))[1]
  loop
    t := replace(t, m, public.storage_cdn_url(m));
  end loop;
  return t::jsonb;
end;
$$;

create or replace function public.storage_backfill_rewrite_urls()
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '15min'
as $$
declare
  res jsonb := '{}'::jsonb;
  n int;
  pfx constant text := '%yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/%';
begin
  -- products.photos (text[])
  insert into storage_url_backup (tbl, row_id, col, old_value)
  select 'products', id::text, 'photos', to_jsonb(photos) from products
   where array_to_string(photos, ' ') like pfx
  on conflict do nothing;
  update products p
     set photos = (select array_agg(storage_cdn_url(x) order by i) from unnest(p.photos) with ordinality as t(x, i))
   where array_to_string(p.photos, ' ') like pfx;
  get diagnostics n = row_count; res := res || jsonb_build_object('products.photos', n);

  -- products.variants / addons (jsonb)
  insert into storage_url_backup (tbl, row_id, col, old_value)
  select 'products', id::text, 'variants', variants from products where variants::text like pfx
  on conflict do nothing;
  update products set variants = storage_cdn_jsonb(variants) where variants::text like pfx;
  get diagnostics n = row_count; res := res || jsonb_build_object('products.variants', n);

  insert into storage_url_backup (tbl, row_id, col, old_value)
  select 'products', id::text, 'addons', addons from products where addons::text like pfx
  on conflict do nothing;
  update products set addons = storage_cdn_jsonb(addons) where addons::text like pfx;
  get diagnostics n = row_count; res := res || jsonb_build_object('products.addons', n);

  -- tenant_uploads.url (galería)
  insert into storage_url_backup (tbl, row_id, col, old_value)
  select 'tenant_uploads', id::text, 'url', to_jsonb(url) from tenant_uploads where url like pfx
  on conflict do nothing;
  update tenant_uploads set url = storage_cdn_url(url) where url like pfx;
  get diagnostics n = row_count; res := res || jsonb_build_object('tenant_uploads.url', n);

  -- chat_messages.media_url
  insert into storage_url_backup (tbl, row_id, col, old_value)
  select 'chat_messages', id::text, 'media_url', to_jsonb(media_url) from chat_messages where media_url like pfx
  on conflict do nothing;
  update chat_messages set media_url = storage_cdn_url(media_url) where media_url like pfx;
  get diagnostics n = row_count; res := res || jsonb_build_object('chat_messages.media_url', n);

  -- tenant_ecommerce_config.logo / banner
  insert into storage_url_backup (tbl, row_id, col, old_value)
  select 'tenant_ecommerce_config', id::text, 'logo', to_jsonb(logo) from tenant_ecommerce_config where logo like pfx
  on conflict do nothing;
  update tenant_ecommerce_config set logo = storage_cdn_url(logo) where logo like pfx;
  get diagnostics n = row_count; res := res || jsonb_build_object('tec.logo', n);

  insert into storage_url_backup (tbl, row_id, col, old_value)
  select 'tenant_ecommerce_config', id::text, 'banner', to_jsonb(banner) from tenant_ecommerce_config where banner like pfx
  on conflict do nothing;
  update tenant_ecommerce_config set banner = storage_cdn_url(banner) where banner like pfx;
  get diagnostics n = row_count; res := res || jsonb_build_object('tec.banner', n);

  -- catalog_imports.file_url
  insert into storage_url_backup (tbl, row_id, col, old_value)
  select 'catalog_imports', id::text, 'file_url', to_jsonb(file_url) from catalog_imports where file_url like pfx
  on conflict do nothing;
  update catalog_imports set file_url = storage_cdn_url(file_url) where file_url like pfx;
  get diagnostics n = row_count; res := res || jsonb_build_object('catalog_imports.file_url', n);

  return res;
end;
$$;

-- Rollback: devuelve cada columna a su valor previo a la reescritura.
create or replace function public.storage_backfill_rollback_urls()
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '15min'
as $$
begin
  update products p set photos = array(select jsonb_array_elements_text(b.old_value))
    from storage_url_backup b where b.tbl = 'products' and b.col = 'photos' and b.row_id = p.id::text;
  update products p set variants = b.old_value
    from storage_url_backup b where b.tbl = 'products' and b.col = 'variants' and b.row_id = p.id::text;
  update products p set addons = b.old_value
    from storage_url_backup b where b.tbl = 'products' and b.col = 'addons' and b.row_id = p.id::text;
  update tenant_uploads t set url = b.old_value #>> '{}'
    from storage_url_backup b where b.tbl = 'tenant_uploads' and b.row_id = t.id::text;
  update chat_messages t set media_url = b.old_value #>> '{}'
    from storage_url_backup b where b.tbl = 'chat_messages' and b.row_id = t.id::text;
  update tenant_ecommerce_config t set logo = b.old_value #>> '{}'
    from storage_url_backup b where b.tbl = 'tenant_ecommerce_config' and b.col = 'logo' and b.row_id = t.id::text;
  update tenant_ecommerce_config t set banner = b.old_value #>> '{}'
    from storage_url_backup b where b.tbl = 'tenant_ecommerce_config' and b.col = 'banner' and b.row_id = t.id::text;
  update catalog_imports t set file_url = b.old_value #>> '{}'
    from storage_url_backup b where b.tbl = 'catalog_imports' and b.row_id = t.id::text;
  return jsonb_build_object('restored', (select count(*) from storage_url_backup));
end;
$$;

revoke all on function public.storage_backfill_rewrite_urls() from public, anon, authenticated;
revoke all on function public.storage_backfill_rollback_urls() from public, anon, authenticated;
