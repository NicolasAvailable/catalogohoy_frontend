-- Campo NIT (Número de Identificación Tributaria, Guatemala) en las órdenes.
-- Se captura en el checkout público solo para los catálogos con la feature
-- activa (allowlist NIT_FEATURE_TENANT_IDS en el front; hoy Droguería El
-- Paisano, tenant 1702), y se muestra en el detalle de la orden + PDF + factura.
--
-- Seguro de agregar: los triggers de `orders` (notify_order_whatsapp, límites)
-- referencian columnas por nombre, no `SELECT *` / `to_jsonb(NEW)`, así que una
-- columna nueva no los afecta.
alter table public.orders add column if not exists nit text;
comment on column public.orders.nit is
  'NIT del cliente (identificación tributaria, Guatemala). Capturado en el checkout público para catálogos con la feature NIT activa.';
