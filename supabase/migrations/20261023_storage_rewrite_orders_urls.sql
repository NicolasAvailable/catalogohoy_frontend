-- CAT-88: reescribe a cdn.catalogohoy.com las URLs de Supabase Storage que quedaban
-- en orders.products (storage_backfill_rewrite_urls() no las tocaba). Seguían generando
-- cached egress al abrir pedidos viejos (web y app móvil).
-- El trigger de WhatsApp (AFTER UPDATE) se desactiva solo dentro de esta transacción
-- para que no se reenvíen notificaciones. Los valores viejos quedan en storage_url_backup
-- (tbl = 'orders', col = 'products').
begin;

insert into storage_url_backup (tbl, row_id, col, old_value)
select 'orders', id::text, 'products', products
from orders
where products::text like '%yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/%'
on conflict do nothing;

alter table orders disable trigger trg_orders_whatsapp_notify;

update orders
set products = replace(products::text,
      'https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/',
      'https://cdn.catalogohoy.com/')::jsonb
where products::text like '%yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/%';

alter table orders enable trigger trg_orders_whatsapp_notify;

commit;
