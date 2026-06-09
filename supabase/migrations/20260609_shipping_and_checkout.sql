-- Shipping methods + configurable customer fields (catalog editor "Envío" tab)
-- and the order-side columns the new checkout writes.
--
-- SAFETY: both tables are tiny (orders ~490 rows, tenant_ecommerce_config ~480).
-- ADD COLUMN ... DEFAULT <const> is a metadata-only operation in PG11+ (no table
-- rewrite), and IF NOT EXISTS makes this idempotent. All three INSERT/UPDATE
-- triggers on `orders` reference columns by name (no SELECT * / to_jsonb(NEW)),
-- so the new columns don't affect them.

-- ── tenant_ecommerce_config ──────────────────────────────────────────────────
ALTER TABLE public.tenant_ecommerce_config
  ADD COLUMN IF NOT EXISTS shipping_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS show_shipping_section boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_fields jsonb NOT NULL DEFAULT
    '{"name":{"visible":true,"required":true},"phone":{"visible":true,"required":true},"email":{"visible":false,"required":false}}'::jsonb;

COMMENT ON COLUMN public.tenant_ecommerce_config.shipping_methods IS
  'Array of shipping options: [{id,name,type,fee,instructions,requestCustomerAddress,address,lat,lng,isActive,isDefault,position}]';
COMMENT ON COLUMN public.tenant_ecommerce_config.customer_fields IS
  'Checkout customer-field config: {name,phone,email} each {visible,required}';

-- ── orders ───────────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS shipping_method  jsonb,            -- {name,type,fee}
  ADD COLUMN IF NOT EXISTS shipping_address text,
  ADD COLUMN IF NOT EXISTS shipping_fee     numeric(12,2) NOT NULL DEFAULT 0;
