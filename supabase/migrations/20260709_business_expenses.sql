-- Gastos actuales del negocio: servicios/suscripciones que paga la empresa
-- (Supabase, Vercel, Google Workspace, …), administrados desde el panel
-- interno. RLS habilitada sin policies (cerrada al cliente); todo el acceso
-- pasa por RPCs SECURITY DEFINER gateadas con _assert_internal_admin, el
-- mismo patrón que enterprise_leads.

CREATE TABLE public.business_expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  company text NOT NULL,
  amount_usd numeric(10,2) NOT NULL CHECK (amount_usd >= 0),
  period text NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'yearly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.list_business_expenses_admin()
 RETURNS TABLE(
   id bigint,
   name text,
   company text,
   amount_usd numeric,
   period text,
   created_at timestamptz
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._assert_internal_admin();

  RETURN QUERY
  SELECT be.id, be.name, be.company, be.amount_usd, be.period, be.created_at
  FROM public.business_expenses be
  ORDER BY be.created_at ASC, be.id ASC;
END;
$function$;

-- p_id NULL = crear; con id = actualizar. Devuelve el id de la fila.
CREATE FUNCTION public.save_business_expense_admin(
  p_id bigint,
  p_name text,
  p_company text,
  p_amount_usd numeric,
  p_period text
)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint;
BEGIN
  PERFORM public._assert_internal_admin();

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'name is required';
  END IF;
  IF p_company IS NULL OR btrim(p_company) = '' THEN
    RAISE EXCEPTION 'company is required';
  END IF;
  IF p_amount_usd IS NULL OR p_amount_usd < 0 THEN
    RAISE EXCEPTION 'amount_usd must be >= 0';
  END IF;
  IF p_period NOT IN ('monthly', 'yearly') THEN
    RAISE EXCEPTION 'period must be monthly or yearly';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.business_expenses (name, company, amount_usd, period)
    VALUES (btrim(p_name), btrim(p_company), p_amount_usd, p_period)
    RETURNING business_expenses.id INTO v_id;
  ELSE
    UPDATE public.business_expenses
    SET name = btrim(p_name),
        company = btrim(p_company),
        amount_usd = p_amount_usd,
        period = p_period,
        updated_at = now()
    WHERE business_expenses.id = p_id
    RETURNING business_expenses.id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'expense % not found', p_id;
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;

CREATE FUNCTION public.delete_business_expense_admin(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._assert_internal_admin();

  DELETE FROM public.business_expenses WHERE business_expenses.id = p_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_business_expenses_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_business_expense_admin(bigint, text, text, numeric, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_business_expense_admin(bigint) TO anon, authenticated, service_role;

-- Seed: gastos actuales conocidos
INSERT INTO public.business_expenses (name, company, amount_usd, period) VALUES
  ('Supabase', 'Supabase', 25.00, 'monthly'),
  ('Vercel', 'Vercel', 20.00, 'monthly'),
  ('Google Workspace', 'Google', 9.00, 'monthly');
