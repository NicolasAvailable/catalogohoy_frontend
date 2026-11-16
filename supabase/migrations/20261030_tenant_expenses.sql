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
  -- Archivos adjuntos: [{ url, name, type }] (fotos, PDF, Excel, Word, XML).
  attachments    jsonb NOT NULL DEFAULT '[]'::jsonb
                 CHECK (jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) <= 10),
  notes          text CHECK (notes IS NULL OR length(notes) <= 1000),
  -- Anti-spam del cron send-expense-reminders (un aviso "por vencer" y uno
  -- "vencida" por factura). Se limpian si cambia la fecha de vencimiento.
  due_reminded_at     timestamptz,
  overdue_reminded_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tenant_expenses_tenant_date_idx
  ON public.tenant_expenses (tenant_id, issue_date DESC);
CREATE INDEX tenant_expenses_pending_due_idx
  ON public.tenant_expenses (due_date) WHERE status = 'pending' AND due_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_tenant_expenses_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  -- Nueva fecha de vencimiento → se vuelve a avisar con la fecha nueva.
  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    NEW.due_reminded_at := NULL;
    NEW.overdue_reminded_at := NULL;
  END IF;
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

-- Preferencia del dueño: avisos de facturas por vencer / vencidas (Perfil →
-- Notificaciones). Default true = recibir.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notify_expense_reminders boolean NOT NULL DEFAULT true;

-- get_my_profile_with_tenants: + notify_expense_reminders en el bloque 'user'.
CREATE OR REPLACE FUNCTION public.get_my_profile_with_tenants()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_user_id int;
  v_user_email text;
begin
  select u.id, u.email
  into v_user_id, v_user_email
  from public.users u
  where u.auth_user_id = auth.uid();

  if v_user_id is null then
    raise exception 'User not found';
  end if;

  return jsonb_build_object(
    'user',
    (
      select jsonb_build_object(
        'id', u.id,
        'name', u.name,
        'email', u.email,
        'phone', u.phone,
        'photo', u.photo,
        'notify_plan_expiry', u.notify_plan_expiry,
        'notify_new_orders_email', u.notify_new_orders_email,
        'notify_weekly_report_email', u.notify_weekly_report_email,
        'notify_orders_inapp', u.notify_orders_inapp,
        'notify_low_stock', u.notify_low_stock,
        'low_stock_threshold', u.low_stock_threshold,
        'notify_credit_reminders', u.notify_credit_reminders,
        'credit_reminder_days', u.credit_reminder_days,
        'notify_expense_reminders', u.notify_expense_reminders
      )
      from public.users u
      where u.id = v_user_id
    ),

    'default_tenant',
    (
      select jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'slug', t.slug,
        'custom_domain', t.custom_domain,
        'role', ut.role
      )
      from public.users_tenants ut
      join public.tenants t on t.id = ut.tenant_id
      where ut.user_id = v_user_id
        and ut.is_default = true
      limit 1
    ),

    'tenants',
    (
      select jsonb_agg(row_data)
      from (
        select jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'slug', t.slug,
          'custom_domain', t.custom_domain,
          'role', ut.role,
          'is_default', ut.is_default
        ) as row_data
        from public.users_tenants ut
        join public.tenants t on t.id = ut.tenant_id
        where ut.user_id = v_user_id

        UNION ALL

        select jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'slug', t.slug,
          'custom_domain', t.custom_domain,
          'role', 'member',
          'is_default', false
        ) as row_data
        from public.team_members tm
        join public.teams te on te.id = tm.team_id
        join public.tenants t on t.id = te.tenant_id
        where tm.status = 'accepted'
          and (tm.user_id = v_user_id OR tm.invited_email = v_user_email)
          and not exists (
            select 1
            from public.users_tenants ut2
            where ut2.user_id = v_user_id
              and ut2.tenant_id = t.id
          )
      ) combined
    )
  );
end;
$function$;

-- Secret del cron: vive en el Vault (`expense_reminders_cron_secret`, se crea
-- al desplegar, nunca en el repo). La edge function lo lee con esta RPC.
CREATE OR REPLACE FUNCTION public._expense_reminders_cron_secret()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'expense_reminders_cron_secret' limit 1;
$function$;
REVOKE ALL ON FUNCTION public._expense_reminders_cron_secret() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._expense_reminders_cron_secret() TO service_role;

-- Cron diario de avisos (después de deployar send-expense-reminders).
-- 12:30 UTC = 08:30 Venezuela.
select cron.unschedule('send-expense-reminders-daily')
where exists (select 1 from cron.job where jobname = 'send-expense-reminders-daily');

select cron.schedule(
  'send-expense-reminders-daily',
  '30 12 * * *',
  $cron$
  select net.http_post(
    url := 'https://yvkurjivijnhliofmfmj.supabase.co/functions/v1/send-expense-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets
                           where name = 'expense_reminders_cron_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $cron$
);
