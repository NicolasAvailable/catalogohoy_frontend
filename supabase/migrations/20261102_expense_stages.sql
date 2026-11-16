-- Estados propios de Gastos y facturas (como los de órdenes) + abonos.
--
-- Cada tienda puede renombrar/colorear/ocultar los 2 estados base ("Por
-- pagar", "Pagada") y crear los suyos ("A crédito", "En revisión"…). Un estado
-- propio se comporta como su `base_status`, que sigue siendo la fuente de
-- verdad en `tenant_expenses.status`: totales, avisos de vencimiento y bot no
-- cambian. El gasto guarda además en qué estado propio está (`stage_id`).
--
-- Una fila con `system_status` NO es un estado nuevo: es la personalización de
-- un estado base.
--
-- `paid_amount` = lo abonado de una factura por pagar (pagos por partes). Por
-- pagar = amount - paid_amount. Con status 'paid' se considera pagada completa.

CREATE TABLE public.expense_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   bigint NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label       text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 40),
  color       text NOT NULL DEFAULT '#8b5cf6' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  base_status text NOT NULL DEFAULT 'pending' CHECK (base_status IN ('pending', 'paid')),
  position    int NOT NULL DEFAULT 0,
  is_hidden   boolean NOT NULL DEFAULT false,
  system_status text CHECK (system_status IN ('pending', 'paid')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_stages_system_base_check
    CHECK (system_status IS NULL OR system_status = base_status)
);
CREATE INDEX expense_stages_tenant_idx ON public.expense_stages (tenant_id, position);
CREATE UNIQUE INDEX expense_stages_system_uniq
  ON public.expense_stages (tenant_id, system_status) WHERE system_status IS NOT NULL;

-- Mismo acceso que los gastos: dueño, o miembro con el permiso `gastos`.
ALTER TABLE public.expense_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY expense_stages_select ON public.expense_stages
  FOR SELECT TO authenticated
  USING (public._tenant_module_allowed(tenant_id, 'gastos', 'view'));
CREATE POLICY expense_stages_insert ON public.expense_stages
  FOR INSERT TO authenticated
  WITH CHECK (public._tenant_module_allowed(tenant_id, 'gastos', 'edit'));
CREATE POLICY expense_stages_update ON public.expense_stages
  FOR UPDATE TO authenticated
  USING (public._tenant_module_allowed(tenant_id, 'gastos', 'edit'))
  WITH CHECK (public._tenant_module_allowed(tenant_id, 'gastos', 'edit'));
CREATE POLICY expense_stages_delete ON public.expense_stages
  FOR DELETE TO authenticated
  USING (public._tenant_module_allowed(tenant_id, 'gastos', 'edit'));

-- Borrar un estado propio deja sus gastos en su estado base (stage_id NULL).
ALTER TABLE public.tenant_expenses
  ADD COLUMN stage_id uuid REFERENCES public.expense_stages(id) ON DELETE SET NULL,
  ADD COLUMN paid_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  ADD CONSTRAINT tenant_expenses_paid_le_amount CHECK (paid_amount <= amount);
CREATE INDEX tenant_expenses_stage_idx ON public.tenant_expenses (stage_id) WHERE stage_id IS NOT NULL;

-- Coherencia para todos los caminos (panel, bot de WhatsApp): el stage debe
-- ser de la misma tienda y un estado propio; si el status pasa a algo distinto
-- del base de su estado propio, sale de ese estado propio.
CREATE OR REPLACE FUNCTION public.tenant_expenses_sync_stage()
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
  FROM public.expense_stages WHERE id = NEW.stage_id AND system_status IS NULL;

  IF v_base IS NULL OR v_tenant IS DISTINCT FROM NEW.tenant_id THEN
    NEW.stage_id := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IS DISTINCT FROM v_base THEN
    NEW.stage_id := NULL;
  ELSIF NEW.status IS DISTINCT FROM v_base THEN
    -- Se asignó un estado propio: el status sigue a su base.
    NEW.status := v_base;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.tenant_expenses_sync_stage() FROM public, anon, authenticated;

CREATE TRIGGER trg_tenant_expenses_sync_stage
  BEFORE INSERT OR UPDATE OF status, stage_id ON public.tenant_expenses
  FOR EACH ROW EXECUTE FUNCTION public.tenant_expenses_sync_stage();
