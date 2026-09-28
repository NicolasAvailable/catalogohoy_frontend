-- Contado y crédito en el checkout público (pedido Moto Fox, extensión CAT-74).
--
-- 1) orders.payment_condition: condición de pago que ELIGIÓ el cliente en el
--    checkout. 'credit' = pidió a crédito (la orden nace `pending`; el
--    comerciante la confirma moviéndola a status 'credit', que es lo que
--    descuenta stock). 'cash' = eligió contado explícitamente. NULL = flujo
--    sin selector (comportamiento actual, órdenes del admin/POS, históricas).
alter table public.orders
  add column if not exists payment_condition text
  constraint orders_payment_condition_check
  check (payment_condition in ('cash', 'credit'));

-- 2) Gate "crédito después de N compras": conteo público de compras previas
--    de un teléfono en una tienda. SECURITY DEFINER a propósito: expone SOLO
--    un número (ningún dato de las órdenes). Matching tolerante a formatos
--    (+58 412…, 0412…, espacios): se comparan los últimos 7 dígitos; con menos
--    de 7 dígitos no hay match (devuelve 0).
create or replace function public.get_customer_purchase_count(
  p_tenant_id bigint,
  p_phone text
) returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from orders o
  where o.tenant_id = p_tenant_id
    and o.status in ('completed', 'credit')
    and length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 7
    and right(regexp_replace(o.phone, '\D', '', 'g'), 7)
      = right(regexp_replace(p_phone, '\D', '', 'g'), 7);
$$;

grant execute on function public.get_customer_purchase_count(bigint, text)
  to anon, authenticated;
