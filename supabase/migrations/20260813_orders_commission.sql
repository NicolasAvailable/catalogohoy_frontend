-- Comisión (opcional) que paga el VENDEDOR sobre una venta manual: se descuenta
-- del total que percibe (total_usd = subtotal + envío − comisión) y es interna
-- (no se le muestra al cliente). Distinta del envío/flete, que lo paga el cliente
-- y suma. Nullable/sin default → órdenes existentes y el checkout público (que no
-- la setea) quedan intactos.
alter table public.orders
  add column if not exists commission numeric;

comment on column public.orders.commission is
  'Comisión opcional que paga el vendedor en una orden manual: se resta de total_usd y no se muestra al cliente. La setea solo el alta manual del admin.';
