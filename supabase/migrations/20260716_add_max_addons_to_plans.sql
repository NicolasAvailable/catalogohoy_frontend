-- Adicionales por producto (product addons) — límite por plan.
--
-- SEGURA PARA PRODUCCIÓN:
--   * Solo AGREGA una columna nueva con DEFAULT; no borra ni modifica datos.
--   * `ADD COLUMN ... DEFAULT` en Postgres es una operación de metadata (no
--     reescribe la tabla), así que no bloquea ni afecta filas existentes.
--   * Idempotente: `IF NOT EXISTS` + updates acotados por nombre de plan.
--
-- Semántica del valor:
--   max_addons = N  -> hasta N adicionales por producto
--   max_addons = 0  -> ilimitado (mismo sentinel que max_products/max_variants)

-- 1) Columna nueva. Default 2 = piso razonable (cubre el caso "corona + lazo").
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_addons integer NOT NULL DEFAULT 2;

-- 2) Reparto por plan (acordado): Gratis 2 · Básico 5 · Avanzado 15 · Enterprise ∞.
--    Se filtra por is_free y por nombre para no depender de ids.
UPDATE public.plans SET max_addons = 2  WHERE is_free = true;
UPDATE public.plans SET max_addons = 5  WHERE lower(name) LIKE '%básico%'   OR lower(name) LIKE '%basico%';
UPDATE public.plans SET max_addons = 15 WHERE lower(name) LIKE '%avanzado%';
UPDATE public.plans SET max_addons = 0  WHERE lower(name) LIKE '%enterprise%';

COMMENT ON COLUMN public.plans.max_addons IS
  'Máximo de adicionales (add-ons) por producto en este plan. 0 = ilimitado.';
