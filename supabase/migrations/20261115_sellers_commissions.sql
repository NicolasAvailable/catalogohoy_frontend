-- CAT-87: Vendedores con comisión (subcatálogos por vendedor).
--
-- Cada tienda puede registrar vendedores (sin acceso al panel). Cada vendedor
-- tiene un link propio `tienda.catalogohoy.com/v/<slug>`: es el mismo catálogo,
-- pero las órdenes que entran por ese link quedan atribuidas al vendedor y el
-- pedido por WhatsApp le llega a él. La comisión es un % por vendedor sobre el
-- subtotal sin envío, y solo cuenta en órdenes completadas.
--
-- Límite por plan: Pro 3 · Avanzado 10 · Enterprise sin límite · Gratis/Básico 0.
--
-- Acceso: dueño del catálogo o miembro de equipo con el permiso del módulo
-- `vendedores` (info de comisiones = financiera).
--
-- Seguridad de la atribución: el catálogo público (anon) solo puede mandar
-- `seller_id`; el trigger valida que el vendedor sea de la misma tienda y esté
-- activo, y copia el % del vendedor (snapshot). El % y el "pagado" nunca se
-- toman de lo que mande el cliente.

-- ---------------------------------------------------------------------------
-- Límite de vendedores según el plan de la tienda.
CREATE OR REPLACE FUNCTION public._seller_limit(p_tenant_id bigint)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case t.plan_id
           when 'pro' then 3
           when 'avanzado' then 10
           when 'enterprise' then 1000
           else 0
         end
  from tenants t where t.id = p_tenant_id;
$function$;

REVOKE ALL ON FUNCTION public._seller_limit(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public._seller_limit(bigint) TO anon, authenticated;

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sellers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      bigint NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  -- Parte final del link: /v/<slug>. Minúsculas, números y guiones.
  slug           text NOT NULL CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  whatsapp       text CHECK (whatsapp IS NULL OR length(whatsapp) <= 25),
  email          text CHECK (email IS NULL OR length(email) <= 120),
  commission_pct numeric(5, 2) NOT NULL DEFAULT 0 CHECK (commission_pct >= 0 AND commission_pct <= 100),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE OR REPLACE FUNCTION public.sellers_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limit int;
  v_count int;
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    v_limit := coalesce(public._seller_limit(NEW.tenant_id), 0);
    SELECT count(*) INTO v_count FROM sellers WHERE tenant_id = NEW.tenant_id;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'seller_limit_reached' USING HINT = v_limit::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sellers_before_write ON public.sellers;
CREATE TRIGGER trg_sellers_before_write
  BEFORE INSERT OR UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.sellers_before_write();

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY sellers_select ON public.sellers
  FOR SELECT TO authenticated
  USING (public._tenant_module_allowed(tenant_id, 'vendedores', 'view'));
CREATE POLICY sellers_insert ON public.sellers
  FOR INSERT TO authenticated
  WITH CHECK (public._tenant_module_allowed(tenant_id, 'vendedores', 'create'));
CREATE POLICY sellers_update ON public.sellers
  FOR UPDATE TO authenticated
  USING (public._tenant_module_allowed(tenant_id, 'vendedores', 'edit'))
  WITH CHECK (public._tenant_module_allowed(tenant_id, 'vendedores', 'edit'));
CREATE POLICY sellers_delete ON public.sellers
  FOR DELETE TO authenticated
  USING (public._tenant_module_allowed(tenant_id, 'vendedores', 'delete'));

-- ---------------------------------------------------------------------------
-- Órdenes: vendedor atribuido + snapshot del % + marca de comisión pagada.
-- Nullable/sin default → las órdenes existentes y los catálogos sin vendedores
-- quedan exactamente igual.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_commission_pct numeric(5, 2),
  ADD COLUMN IF NOT EXISTS seller_commission_paid_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_seller_created_idx
  ON public.orders (seller_id, created_at DESC) WHERE seller_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.orders_attach_seller()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pct numeric;
BEGIN
  IF NEW.seller_id IS NULL THEN
    NEW.seller_commission_pct := NULL;
    NEW.seller_commission_paid_at := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.seller_id IS NOT DISTINCT FROM OLD.seller_id THEN
    RETURN NEW;
  END IF;

  -- Mismo catálogo; en el alta (link público) además debe estar activo.
  SELECT s.commission_pct INTO v_pct
  FROM sellers s
  WHERE s.id = NEW.seller_id
    AND s.tenant_id = NEW.tenant_id
    AND (TG_OP = 'UPDATE' OR s.is_active);

  IF NOT FOUND THEN
    NEW.seller_id := NULL;
    NEW.seller_commission_pct := NULL;
  ELSE
    NEW.seller_commission_pct := v_pct;
  END IF;
  NEW.seller_commission_paid_at := NULL;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_orders_attach_seller_ins ON public.orders;
CREATE TRIGGER trg_orders_attach_seller_ins
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.seller_id IS NOT NULL OR NEW.seller_commission_pct IS NOT NULL OR NEW.seller_commission_paid_at IS NOT NULL)
  EXECUTE FUNCTION public.orders_attach_seller();

DROP TRIGGER IF EXISTS trg_orders_attach_seller_upd ON public.orders;
CREATE TRIGGER trg_orders_attach_seller_upd
  BEFORE UPDATE OF seller_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_attach_seller();

-- ---------------------------------------------------------------------------
-- Catálogo público: resolver /v/<slug> → vendedor (sin exponer el %).
CREATE OR REPLACE FUNCTION public.get_public_seller(p_tenant_id bigint, p_slug text)
 RETURNS TABLE (id uuid, name text, whatsapp text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.name, s.whatsapp
  from sellers s
  where s.tenant_id = p_tenant_id
    and s.slug = lower(btrim(p_slug))
    and s.is_active
    and public._seller_limit(s.tenant_id) > 0
  limit 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_seller(bigint, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_seller(bigint, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Base de la comisión de una orden: lo que pagó el cliente sin el envío. En
-- órdenes manuales `total_usd` ya viene sin la comisión de la venta manual,
-- así que se suma de vuelta.
CREATE OR REPLACE FUNCTION public._order_commission_base(o public.orders)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select greatest(
    coalesce(o.total_usd, 0) - coalesce(o.shipping_fee, 0) + coalesce(o.commission, 0),
    0
  );
$function$;

-- Reporte por vendedor en un rango [p_from, p_to). Incluye vendedores sin
-- ventas. Solo las órdenes completadas generan comisión; las abiertas
-- (pendientes / a crédito) se informan aparte; las canceladas no cuentan.
CREATE OR REPLACE FUNCTION public.get_seller_commissions(
  p_tenant_id bigint, p_from timestamptz, p_to timestamptz
)
 RETURNS TABLE (
   seller_id uuid,
   name text,
   slug text,
   whatsapp text,
   commission_pct numeric,
   is_active boolean,
   completed_orders integer,
   sales numeric,
   commission numeric,
   commission_paid numeric,
   commission_pending numeric,
   open_orders integer,
   open_sales numeric
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._tenant_module_allowed(p_tenant_id, 'vendedores', 'view') THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  RETURN QUERY
  WITH o AS (
    SELECT ord.seller_id AS sid,
           ord.status,
           public._order_commission_base(ord) AS base,
           coalesce(ord.seller_commission_pct, 0) AS pct,
           ord.seller_commission_paid_at AS paid_at
    FROM orders ord
    WHERE ord.tenant_id = p_tenant_id
      AND ord.seller_id IS NOT NULL
      AND ord.created_at >= p_from
      AND ord.created_at < p_to
  )
  SELECT s.id,
         s.name,
         s.slug,
         s.whatsapp,
         s.commission_pct,
         s.is_active,
         count(o.sid) FILTER (WHERE o.status = 'completed')::int,
         coalesce(sum(o.base) FILTER (WHERE o.status = 'completed'), 0),
         round(coalesce(sum(o.base * o.pct / 100) FILTER (WHERE o.status = 'completed'), 0), 2),
         round(coalesce(sum(o.base * o.pct / 100) FILTER (WHERE o.status = 'completed' AND o.paid_at IS NOT NULL), 0), 2),
         round(coalesce(sum(o.base * o.pct / 100) FILTER (WHERE o.status = 'completed' AND o.paid_at IS NULL), 0), 2),
         count(o.sid) FILTER (WHERE o.status NOT IN ('completed', 'cancelled'))::int,
         coalesce(sum(o.base) FILTER (WHERE o.status NOT IN ('completed', 'cancelled')), 0)
  FROM sellers s
  LEFT JOIN o ON o.sid = s.id
  WHERE s.tenant_id = p_tenant_id
  GROUP BY s.id
  ORDER BY s.is_active DESC, s.name;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_seller_commissions(bigint, timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_commissions(bigint, timestamptz, timestamptz) TO authenticated;

-- Marcar (o desmarcar) como pagadas las comisiones de un vendedor en un rango.
-- Solo afecta órdenes completadas. Devuelve cuántas órdenes cambió.
CREATE OR REPLACE FUNCTION public.set_seller_commissions_paid(
  p_seller_id uuid, p_from timestamptz, p_to timestamptz, p_paid boolean
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant bigint;
  v_count int;
BEGIN
  SELECT tenant_id INTO v_tenant FROM sellers WHERE id = p_seller_id;
  IF v_tenant IS NULL OR NOT public._tenant_module_allowed(v_tenant, 'vendedores', 'edit') THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  UPDATE orders
     SET seller_commission_paid_at = CASE WHEN p_paid THEN now() ELSE NULL END
   WHERE tenant_id = v_tenant
     AND seller_id = p_seller_id
     AND status = 'completed'
     AND created_at >= p_from
     AND created_at < p_to
     AND (CASE WHEN p_paid THEN seller_commission_paid_at IS NULL ELSE seller_commission_paid_at IS NOT NULL END);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_seller_commissions_paid(uuid, timestamptz, timestamptz, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_seller_commissions_paid(uuid, timestamptz, timestamptz, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
