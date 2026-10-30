-- Gastos de la tienda: facturas de proveedores, compras de mercancía y otros
-- pagos (alquiler, transporte, servicios…) en un solo lugar. Base para el
-- balance mensual (gastos vs. ventas). Pedido por Distribuidor Motomax.
--
-- Acceso: dueño del catálogo, o miembro de equipo aceptado con el permiso del
-- módulo `gastos` (los demás miembros NO ven los gastos: es info financiera).

-- ¿El usuario actual puede hacer `p_action` en el módulo `p_module` de la
-- tienda? Dueño (users_tenants) = todo; miembro = según team_member_permissions.
CREATE OR REPLACE FUNCTION public._tenant_module_allowed(
  p_tenant_id bigint, p_module text, p_action text
)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from users_tenants ut join users u on u.id = ut.user_id
    where ut.tenant_id = p_tenant_id and u.auth_user_id = auth.uid()
  ) or exists (
    select 1 from team_member_permissions p
      join team_members tm on tm.id = p.team_member_id
      join teams t on t.id = tm.team_id
      join users u on u.id = tm.user_id
    where t.tenant_id = p_tenant_id
      and u.auth_user_id = auth.uid()
      and tm.status = 'accepted'
      and p.module = p_module
      and p.action = p_action
  );
$function$;

REVOKE ALL ON FUNCTION public._tenant_module_allowed(bigint, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public._tenant_module_allowed(bigint, text, text) TO authenticated;

CREATE TABLE public.tenant_expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      bigint NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier       text CHECK (supplier IS NULL OR length(supplier) <= 120),
  invoice_number text CHECK (invoice_number IS NULL OR length(invoice_number) <= 60),
  category       text NOT NULL DEFAULT 'mercancia'
                 CHECK (category IN ('mercancia', 'servicios', 'transporte', 'alquiler',
                                     'sueldos', 'impuestos', 'publicidad', 'otros')),
  description    text CHECK (description IS NULL OR length(description) <= 300),
  amount         numeric(14, 2) NOT NULL CHECK (amount >= 0),
  currency       text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  issue_date     date NOT NULL DEFAULT current_date,
  due_date       date,
  status         text NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid')),
  paid_at        date,
  file_url       text,
  file_name      text,
  notes          text CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tenant_expenses_tenant_date_idx
  ON public.tenant_expenses (tenant_id, issue_date DESC);

CREATE OR REPLACE FUNCTION public.touch_tenant_expenses_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_tenant_expenses_updated_at
  BEFORE UPDATE ON public.tenant_expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_tenant_expenses_updated_at();

ALTER TABLE public.tenant_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_expenses_select ON public.tenant_expenses
  FOR SELECT TO authenticated
  USING (public._tenant_module_allowed(tenant_id, 'gastos', 'view'));
CREATE POLICY tenant_expenses_insert ON public.tenant_expenses
  FOR INSERT TO authenticated
  WITH CHECK (public._tenant_module_allowed(tenant_id, 'gastos', 'create'));
CREATE POLICY tenant_expenses_update ON public.tenant_expenses
  FOR UPDATE TO authenticated
  USING (public._tenant_module_allowed(tenant_id, 'gastos', 'edit'))
  WITH CHECK (public._tenant_module_allowed(tenant_id, 'gastos', 'edit'));
CREATE POLICY tenant_expenses_delete ON public.tenant_expenses
  FOR DELETE TO authenticated
  USING (public._tenant_module_allowed(tenant_id, 'gastos', 'delete'));
