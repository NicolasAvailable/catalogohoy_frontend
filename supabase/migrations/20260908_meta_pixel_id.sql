-- Meta (Facebook) Pixel per-tenant para el catálogo público.
--
-- `meta_pixel_id` es un dato PÚBLICO (el navegador lo necesita para inicializar
-- el pixel del comerciante). Viaja por `get_public_catalog` (ver más abajo) y el
-- storefront lo inyecta con fbq('trackSingle', <pixel>, ...), aislado del pixel
-- propio de CatalogoHoy y de los pixels de otros catálogos.
--
-- El TOKEN de la Conversions API (secreto) NO va acá: vive en su propia tabla
-- `meta_capi_credentials` (RLS por tenant, solo lo leen las edge functions con
-- service role) — ver la migración de CAPI.

ALTER TABLE public.tenant_ecommerce_config
  ADD COLUMN IF NOT EXISTS meta_pixel_id text;

COMMENT ON COLUMN public.tenant_ecommerce_config.meta_pixel_id IS
  'Meta Pixel ID del comerciante (público). Solo planes pagos lo configuran; el '
  'storefront lo inicializa y dispara ViewContent/AddToCart/InitiateCheckout/Lead.';

-- NOTA (RPC drift): la función get_public_catalog debe incluir `meta_pixel_id`
-- en su sub-select de `config`. La re-definición se aplica en prod con la
-- definición VIVA capturada con pg_get_functiondef (el repo va atrás de prod).
-- Solo hay que agregar `meta_pixel_id` a la lista de columnas del bloque:
--   'config', ( SELECT row_to_json(c) FROM ( SELECT ... , meta_pixel_id
--               FROM tenant_ecommerce_config WHERE tenant_id = v_tenant_id ) c )
