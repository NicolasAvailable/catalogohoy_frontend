-- Estados de orden personalizados por tienda ("Despacho", "Revisión"...).
--
-- Una fila con `system_status` NO es un estado nuevo: guarda la personalización
-- (nombre, color, posición, oculto) de uno de los 4 estados base. Sin fila, el
-- estado base usa su nombre/color de siempre.
--
-- Cada estado propio se comporta como uno de los 4 estados base
-- (`base_status`), que sigue siendo la fuente de verdad en `orders.status`:
-- stock, métricas, notificaciones y reportes NO cambian. La orden solo guarda
-- además en qué estado propio está (`orders.stage_id`). Ej: "Despacho" con
-- base 'pending' = la orden sigue pendiente (no descuenta stock), pero se ve y
-- se filtra como "Despacho".

CREATE TABLE public.order_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   bigint NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label       text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 40),
  color       text NOT NULL DEFAULT '#8b5cf6' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  base_status text NOT NULL DEFAULT 'pending'
              CHECK (base_status IN ('pending', 'completed', 'credit', 'cancelled')),
  position    int NOT NULL DEFAULT 0,
  is_hidden   boolean NOT NULL DEFAULT false,
  system_status text CHECK (system_status IN ('pending', 'completed', 'credit', 'cancelled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_stages_system_base_check
    CHECK (system_status IS NULL OR system_status = base_status)
);
CREATE INDEX order_stages_tenant_idx ON public.order_stages (tenant_id, position);
CREATE UNIQUE INDEX order_stages_system_uniq
  ON public.order_stages (tenant_id, system_status) WHERE system_status IS NOT NULL;

ALTER TABLE public.order_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_stages_select_member ON public.order_stages
  FOR SELECT TO authenticated USING (public._pos_can_access_tenant(tenant_id));
CREATE POLICY order_stages_insert_member ON public.order_stages
  FOR INSERT TO authenticated WITH CHECK (public._pos_can_access_tenant(tenant_id));
CREATE POLICY order_stages_update_member ON public.order_stages
  FOR UPDATE TO authenticated
  USING (public._pos_can_access_tenant(tenant_id))
  WITH CHECK (public._pos_can_access_tenant(tenant_id));
CREATE POLICY order_stages_delete_member ON public.order_stages
  FOR DELETE TO authenticated USING (public._pos_can_access_tenant(tenant_id));

-- Borrar un estado propio deja sus órdenes en su estado base (stage_id NULL).
ALTER TABLE public.orders
  ADD COLUMN stage_id uuid REFERENCES public.order_stages(id) ON DELETE SET NULL;
CREATE INDEX orders_stage_idx ON public.orders (stage_id) WHERE stage_id IS NOT NULL;

-- Coherencia para TODOS los caminos que cambian el estado (panel, POS, bot de
-- WhatsApp, MCP): si la orden pasa a un status que no es el base de su estado
-- propio, sale de ese estado propio. Y si alguien asigna un stage_id, el
-- status queda alineado con su base y debe ser de la misma tienda.
CREATE OR REPLACE FUNCTION public.orders_sync_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base text;
  v_tenant bigint;
BEGIN
  IF NEW.stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT base_status, tenant_id INTO v_base, v_tenant
  FROM public.order_stages WHERE id = NEW.stage_id AND system_status IS NULL;

  IF v_base IS NULL OR v_tenant IS DISTINCT FROM NEW.tenant_id THEN
    NEW.stage_id := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IS DISTINCT FROM v_base THEN
    -- Cambio de status sin tocar el estado propio → sale del estado propio.
    NEW.stage_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_orders_sync_stage
  BEFORE INSERT OR UPDATE OF status, stage_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_sync_stage();
