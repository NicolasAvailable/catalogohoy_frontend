-- Per-tenant incremental order number (display-only).
--
-- The global orders.id stays the PK used for routing and lookups; this column
-- only powers the tenant-scoped "#N" shown in the admin UI / PDF, so tenants no
-- longer see the global sequence (which leaked the existence of other tenants'
-- orders and looked wrong: a tenant's first order showing as #139, etc.).

ALTER TABLE public.orders ADD COLUMN order_number integer;

-- Backfill: 1..N per tenant, ordered by id (creation order).
WITH n AS (
  SELECT id, row_number() OVER (PARTITION BY tenant_id ORDER BY id) AS rn
  FROM public.orders
)
UPDATE public.orders o SET order_number = n.rn FROM n WHERE o.id = n.id;

-- Assign the next per-tenant number on insert.
-- SECURITY DEFINER so it keeps working even if anon SELECT on orders is later
-- restricted (the pending RLS hardening); the advisory lock serializes
-- concurrent inserts for the same tenant to avoid duplicate numbers.
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    PERFORM pg_advisory_xact_lock(NEW.tenant_id);
    SELECT COALESCE(MAX(order_number), 0) + 1 INTO NEW.order_number
    FROM public.orders WHERE tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_set_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

CREATE UNIQUE INDEX orders_tenant_order_number_uidx
ON public.orders (tenant_id, order_number);
