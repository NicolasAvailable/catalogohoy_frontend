-- Gastos no recurrentes (pagos únicos): period = 'one_time' + expense_month
-- (primer día del mes en que se pagó). Solo suman al total de ese mes.
-- La tabla ya tiene RLS habilitada sin policies (acceso solo vía RPCs
-- SECURITY DEFINER con _assert_internal_admin); se reafirma acá.

ALTER TABLE public.business_expenses
  ADD COLUMN expense_month date;

ALTER TABLE public.business_expenses
  DROP CONSTRAINT business_expenses_period_check;

ALTER TABLE public.business_expenses
  ADD CONSTRAINT business_expenses_period_check
    CHECK (period IN ('monthly', 'yearly', 'one_time'));

ALTER TABLE public.business_expenses
  ADD CONSTRAINT business_expenses_one_time_month_check
    CHECK ((period = 'one_time') = (expense_month IS NOT NULL));

ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;

DROP FUNCTION public.list_business_expenses_admin();

CREATE FUNCTION public.list_business_expenses_admin()
 RETURNS TABLE(
   id bigint,
   name text,
   company text,
   amount_usd numeric,
   period text,
   expense_month date,
   created_at timestamptz
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._assert_internal_admin();

  RETURN QUERY
  SELECT be.id, be.name, be.company, be.amount_usd, be.period,
         be.expense_month, be.created_at
  FROM public.business_expenses be
  ORDER BY be.created_at ASC, be.id ASC;
END;
$function$;

DROP FUNCTION public.save_business_expense_admin(bigint, text, text, numeric, text);

-- p_id NULL = crear; con id = actualizar. Devuelve el id de la fila.
-- p_expense_month solo para period = 'one_time' (se normaliza al día 1).
CREATE FUNCTION public.save_business_expense_admin(
  p_id bigint,
  p_name text,
  p_company text,
  p_amount_usd numeric,
  p_period text,
  p_expense_month date DEFAULT NULL
)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint;
  v_month date;
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
  IF p_period IS NULL OR p_period NOT IN ('monthly', 'yearly', 'one_time') THEN
    RAISE EXCEPTION 'period must be monthly, yearly or one_time';
  END IF;

  IF p_period = 'one_time' THEN
    IF p_expense_month IS NULL THEN
      RAISE EXCEPTION 'expense_month is required for one_time expenses';
    END IF;
    v_month := date_trunc('month', p_expense_month)::date;
  ELSE
    v_month := NULL;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.business_expenses (name, company, amount_usd, period, expense_month)
    VALUES (btrim(p_name), btrim(p_company), p_amount_usd, p_period, v_month)
    RETURNING business_expenses.id INTO v_id;
  ELSE
    UPDATE public.business_expenses
    SET name = btrim(p_name),
        company = btrim(p_company),
        amount_usd = p_amount_usd,
        period = p_period,
        expense_month = v_month,
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

GRANT EXECUTE ON FUNCTION public.list_business_expenses_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_business_expense_admin(bigint, text, text, numeric, text, date) TO anon, authenticated, service_role;
