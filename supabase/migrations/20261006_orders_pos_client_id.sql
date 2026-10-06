-- CAT-85 (POS offline, F2): idempotencia de la cola de ventas offline.
-- Cada venta cobrada sin conexión nace con un uuid generado en el dispositivo;
-- al sincronizar, el índice único (tenant_id, pos_client_id) garantiza que un
-- sync cortado a la mitad nunca duplique la orden (el 23505 se trata como
-- "ya sincronizada"). NULL para todas las órdenes normales.
alter table public.orders
  add column if not exists pos_client_id uuid;

create unique index if not exists orders_pos_client_unique
  on public.orders (tenant_id, pos_client_id)
  where pos_client_id is not null;

comment on column public.orders.pos_client_id is
  'UUID generado por el POS para ventas offline (idempotencia del sync). NULL = orden normal.';
