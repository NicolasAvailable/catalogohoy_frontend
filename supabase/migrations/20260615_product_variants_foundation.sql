-- Product variants (TakeApp-style): named variants with their own price/image.
-- A product can have N variants; the customer picks one and that variant's
-- price is used in cart/checkout/order. Additive + backward compatible:
-- products without variants (is_variant=false, variants=[]) behave as today.
--
-- variants jsonb shape: [{ id, name, price, originalPrice, photo }]
-- Variants are exclusive with sizes (is_sized) and wholesale (is_wholesale).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_variant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Per-plan cap on how many variants a product can have:
-- gratis = 1, basico = 3, avanzado = 15.
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS max_variants integer NOT NULL DEFAULT 1;

UPDATE plans SET max_variants = 1 WHERE id = 'gratis';
UPDATE plans SET max_variants = 3 WHERE id = 'basico';
UPDATE plans SET max_variants = 15 WHERE id = 'avanzado';
