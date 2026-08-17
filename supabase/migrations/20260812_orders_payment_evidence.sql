-- Evidencia de pago (solo admin) para órdenes/ventas manuales.
--
-- Guarda un objeto { note: text, images: string[] } con la nota del pago y las
-- URLs de las imágenes subidas (captura de transferencia, comprobante…).
--
-- Nullable y sin default: las filas existentes y el checkout del catálogo
-- público (que nunca la escribe) quedan intactos. Solo el formulario de órdenes
-- del admin (libs/catalogohoy/order order-save) escribe esta columna, y nunca se
-- imprime en el PDF del recibo del cliente.
alter table public.orders
  add column if not exists payment_evidence jsonb;

comment on column public.orders.payment_evidence is
  'Admin-only proof of payment {note, images:[]} captured from the admin order form. Never set by the public catalog checkout; never printed on the customer receipt PDF.';
