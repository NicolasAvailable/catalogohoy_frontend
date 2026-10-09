-- CAT-84: IVA/impuesto configurable por catálogo (desglose informativo en
-- recibo POS, factura PDF y storefront). El precio YA incluye el impuesto;
-- esto solo muestra el desglose. NULL/0 = apagado (default).
-- ⚠️ Aplicada a prod el 2026-10-04 vía apply_migration (incluye recrear
-- get_public_catalog sobre la definición VIVA con tax_rate/tax_label en el
-- sub-select de config — ver gotcha rpc-drift-public-catalog).
alter table public.tenant_ecommerce_config
  add column if not exists tax_rate numeric(5,2),
  add column if not exists tax_label text;

comment on column public.tenant_ecommerce_config.tax_rate is
  'Porcentaje de impuesto INCLUIDO en los precios (ej. 16 = IVA 16%). NULL/0 = no mostrar desglose.';
comment on column public.tenant_ecommerce_config.tax_label is
  'Etiqueta del impuesto (IVA, ITBIS, IGV...). Default visual: IVA.';
