-- CAT-74: ajuste (descuento/recargo) del método de pago aplicado a la orden.
-- Snapshot { label, amount(signed, <0 = descuento), magnitude, kind, visible }
-- para itemizar la línea en la factura. Aditiva, nullable, retrocompatible
-- (null = sin ajuste). Ya aplicada a prod vía MCP el 2026-09-22.
alter table public.orders
  add column if not exists payment_adjustment jsonb;

comment on column public.orders.payment_adjustment is
  'Ajuste (descuento/recargo) del metodo de pago aplicado a la orden: {label, amount(signed, <0=descuento), magnitude, kind, visible}. Snapshot al momento de la orden; se muestra como linea en la factura. Null = sin ajuste.';
