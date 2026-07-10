-- Plan Enterprise: fila en `plans` + RPCs con listas de planes hardcodeadas.
-- Aplicada en prod el 2026-07-07 como add_enterprise_plan.
-- Los cuerpos de las funciones parten de pg_get_functiondef de prod (el repo
-- está atrás); el único cambio es sumar 'enterprise' al IN / CASE.

-- 1) Fila del plan (sin checkout self-service: stripe_price_id_* quedan NULL)
insert into public.plans (id, name, description, price, max_products, max_catalogs,
                          max_team_members, max_variants, is_free, position)
values ('enterprise', 'Enterprise', 'Para empresas con operaciones a gran escala.',
        0, 0, 10, 50, 100, false, 3)
on conflict (id) do nothing;

-- 2) assign_tenant_plan_admin — overload de 7 parámetros
CREATE OR REPLACE FUNCTION public.assign_tenant_plan_admin(p_tenant_id bigint, p_tier text, p_cycle text, p_amount_usd numeric DEFAULT NULL::numeric, p_payment_method text DEFAULT NULL::text, p_payment_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_history_id bigint;
  v_months int;
  v_now timestamptz := now();
  v_cur_expires timestamptz;
  v_cur_started timestamptz;
  v_started timestamptz;
  v_expires timestamptz;
BEGIN
  PERFORM public._assert_internal_admin();

  IF p_tier NOT IN ('basico', 'avanzado', 'enterprise') THEN
    RAISE EXCEPTION 'invalid tier: %', p_tier;
  END IF;

  v_months := CASE p_cycle
    WHEN 'monthly' THEN 1
    WHEN 'quarterly' THEN 3
    WHEN 'annual' THEN 12
    ELSE 1
  END;

  -- Renovación: si el plan sigue vigente, extendemos desde el vencimiento
  -- actual y conservamos la fecha de inicio; si no, arranca hoy.
  SELECT plan_expires_at, plan_started_at INTO v_cur_expires, v_cur_started
    FROM public.tenants WHERE id = p_tenant_id;
  IF v_cur_expires IS NOT NULL AND v_cur_expires > v_now THEN
    v_started := COALESCE(v_cur_started, v_now);
    v_expires := v_cur_expires + (v_months || ' months')::interval;
  ELSE
    v_started := v_now;
    v_expires := v_now + (v_months || ' months')::interval;
  END IF;

  UPDATE public.tenants
  SET
    plan_id = p_tier,
    plan_started_at = v_started,
    plan_expires_at = v_expires,
    plan_expired = false,
    updated_at = now()
  WHERE id = p_tenant_id;

  UPDATE public.tenant_subscriptions
  SET status = 'expired', updated_at = now()
  WHERE tenant_id = p_tenant_id AND status = 'active';

  INSERT INTO public.tenant_subscriptions (
    tenant_id, tier, cycle, amount_usd, payment_method, payment_reference, notes,
    status, started_at, expires_at, created_by
  ) VALUES (
    p_tenant_id, p_tier, p_cycle, p_amount_usd, p_payment_method, p_payment_reference, p_notes,
    'active', v_started, v_expires, auth.uid()
  )
  RETURNING id INTO v_history_id;

  RETURN v_history_id;
END;
$function$;

-- 3) assign_tenant_plan_admin — overload de 8 parámetros (con consumo de crédito)
CREATE OR REPLACE FUNCTION public.assign_tenant_plan_admin(p_tenant_id bigint, p_tier text, p_cycle text, p_amount_usd numeric DEFAULT NULL::numeric, p_payment_method text DEFAULT NULL::text, p_payment_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_consume_credit_usd numeric DEFAULT NULL::numeric)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_history_id bigint;
  v_months int;
  v_now timestamptz := now();
  v_cur_expires timestamptz;
  v_cur_started timestamptz;
  v_started timestamptz;
  v_expires timestamptz;
  v_current_credit numeric;
  v_prior_subs_count int;
  v_referral_result jsonb;
BEGIN
  PERFORM public._assert_internal_admin();

  IF p_tier NOT IN ('basico', 'avanzado', 'enterprise') THEN
    RAISE EXCEPTION 'invalid tier: %', p_tier;
  END IF;

  v_months := CASE p_cycle
    WHEN 'monthly' THEN 1
    WHEN 'quarterly' THEN 3
    WHEN 'annual' THEN 12
    ELSE 1
  END;

  -- Renovación: si el plan sigue vigente, extendemos desde el vencimiento
  -- actual y conservamos la fecha de inicio; si no, arranca hoy.
  SELECT plan_expires_at, plan_started_at INTO v_cur_expires, v_cur_started
    FROM public.tenants WHERE id = p_tenant_id;
  IF v_cur_expires IS NOT NULL AND v_cur_expires > v_now THEN
    v_started := COALESCE(v_cur_started, v_now);
    v_expires := v_cur_expires + (v_months || ' months')::interval;
  ELSE
    v_started := v_now;
    v_expires := v_now + (v_months || ' months')::interval;
  END IF;

  -- Consumo opcional de crédito de referidos del tenant (cuando renueva).
  IF p_consume_credit_usd IS NOT NULL AND p_consume_credit_usd > 0 THEN
    SELECT referral_credit_usd INTO v_current_credit
      FROM public.tenants WHERE id = p_tenant_id FOR UPDATE;

    IF v_current_credit IS NULL OR v_current_credit < p_consume_credit_usd THEN
      RAISE EXCEPTION 'insufficient_credit: tenant has % USD, attempted to consume %',
        COALESCE(v_current_credit, 0), p_consume_credit_usd;
    END IF;

    UPDATE public.tenants
       SET referral_credit_usd      = referral_credit_usd - p_consume_credit_usd,
           referral_credit_used_usd = referral_credit_used_usd + p_consume_credit_usd,
           updated_at               = now()
     WHERE id = p_tenant_id;
  END IF;

  -- Contar subscripciones previas ANTES del insert para decidir si es primer pago.
  SELECT COUNT(*) INTO v_prior_subs_count
    FROM public.tenant_subscriptions
   WHERE tenant_id = p_tenant_id;

  -- Source of truth: write to tenants
  UPDATE public.tenants
  SET
    plan_id = p_tier,
    plan_started_at = v_started,
    plan_expires_at = v_expires,
    plan_expired = false,
    updated_at = now()
  WHERE id = p_tenant_id;

  -- Sidecar history: expire any prior active subscription, then insert new
  UPDATE public.tenant_subscriptions
  SET status = 'expired', updated_at = now()
  WHERE tenant_id = p_tenant_id AND status = 'active';

  INSERT INTO public.tenant_subscriptions (
    tenant_id, tier, cycle, amount_usd, payment_method, payment_reference, notes,
    status, started_at, expires_at, created_by
  ) VALUES (
    p_tenant_id, p_tier, p_cycle, p_amount_usd, p_payment_method, p_payment_reference, p_notes,
    'active', v_started, v_expires, auth.uid()
  )
  RETURNING id INTO v_history_id;

  -- Si es PRIMER pago del tenant y tiene referral pending, disparar reward.
  IF v_prior_subs_count = 0 AND p_amount_usd IS NOT NULL AND p_amount_usd > 0 THEN
    v_referral_result := public.apply_referral_reward(
      p_tenant_id,
      p_amount_usd,
      COALESCE(p_payment_method, 'pago_movil')
    );
    INSERT INTO public._debug_logs (fn_name, message)
    VALUES ('assign_tenant_plan_admin', format(
      'referral after first assign tenant=%s: %s', p_tenant_id, v_referral_result::text
    ));
  END IF;

  RETURN v_history_id;
END;
$function$;

-- 4) list_paying_clients_admin — incluir enterprise en el panel de pagantes
CREATE OR REPLACE FUNCTION public.list_paying_clients_admin()
 RETURNS TABLE(tenant_id bigint, tenant_name text, tenant_slug text, tenant_logo text, owner_name text, owner_email text, owner_avatar_url text, tier text, cycle text, started_at timestamp with time zone, expires_at timestamp with time zone, days_until_expiry integer, country_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._assert_internal_admin();

  RETURN QUERY
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    tec.logo AS tenant_logo,
    owner_data.name AS owner_name,
    owner_data.email AS owner_email,
    owner_data.avatar_url AS owner_avatar_url,
    t.plan_id AS tier,
    (
      SELECT ts.cycle
      FROM public.tenant_subscriptions ts
      WHERE ts.tenant_id = t.id AND ts.status = 'active'
      ORDER BY ts.started_at DESC
      LIMIT 1
    ) AS cycle,
    t.plan_started_at AS started_at,
    t.plan_expires_at AS expires_at,
    CASE
      WHEN t.plan_expires_at IS NULL THEN NULL
      ELSE EXTRACT(DAY FROM (t.plan_expires_at - now()))::int
    END AS days_until_expiry,
    t.country_code AS country_code
  FROM public.tenants t
  LEFT JOIN public.tenant_ecommerce_config tec ON tec.tenant_id = t.id
  LEFT JOIN LATERAL (
    SELECT
      TRIM(CONCAT_WS(' ', u.name, u.last_name)) AS name,
      u.email,
      COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture') AS avatar_url
    FROM public.users_tenants ut
    JOIN public.users u ON u.id = ut.user_id
    LEFT JOIN auth.users au ON au.id = u.auth_user_id
    WHERE ut.tenant_id = t.id
    ORDER BY
      ut.is_default DESC NULLS LAST,
      (ut.role = 'owner') DESC,
      ut.id ASC
    LIMIT 1
  ) owner_data ON true
  WHERE t.plan_id IN ('basico', 'avanzado', 'enterprise')
  ORDER BY t.plan_started_at DESC NULLS LAST;
END;
$function$;

-- 5) ensure_ai_credits — allowance enterprise 2000
CREATE OR REPLACE FUNCTION public.ensure_ai_credits(p_user_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_allow integer;
begin
  if exists (select 1 from ai_credits where user_id = p_user_id) then return; end if;
  select coalesce(max(case t.plan_id when 'enterprise' then 2000 when 'avanzado' then 500 when 'basico' then 200 else 15 end),15)
    into v_allow
  from users_tenants ut left join tenants t on t.id = ut.tenant_id
  where ut.user_id = p_user_id and ut.role='owner';
  insert into ai_credits(user_id, monthly_allowance, monthly_balance, reset_at)
  values (p_user_id, coalesce(v_allow,15), coalesce(v_allow,15), now()+interval '1 month')
  on conflict (user_id) do nothing;
end; $function$;

-- 6) reset_due_ai_credits — allowance enterprise 2000
CREATE OR REPLACE FUNCTION public.reset_due_ai_credits()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_count integer;
begin
  with owner_allow as (
    select ut.user_id,
      coalesce(max(case t.plan_id when 'enterprise' then 2000 when 'avanzado' then 500 when 'basico' then 200 else 15 end),15) as allowance
    from users_tenants ut left join tenants t on t.id=ut.tenant_id
    where ut.role='owner' group by ut.user_id
  )
  update ai_credits c
  set monthly_allowance = oa.allowance,
      monthly_balance = oa.allowance,
      reset_at = now() + interval '1 month',
      updated_at = now()
  from owner_allow oa
  where c.user_id = oa.user_id and c.reset_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end; $function$;

-- 7) sync_ai_credits_on_plan_change — allowance enterprise 2000
CREATE OR REPLACE FUNCTION public.sync_ai_credits_on_plan_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; v_allow integer;
begin
  for r in
    select ut.user_id from users_tenants ut
    where ut.tenant_id = NEW.id and ut.role = 'owner'
  loop
    perform public.ensure_ai_credits(r.user_id);
    select coalesce(max(case t.plan_id when 'enterprise' then 2000 when 'avanzado' then 500 when 'basico' then 200 else 15 end), 15)
      into v_allow
    from users_tenants ut left join tenants t on t.id = ut.tenant_id
    where ut.user_id = r.user_id and ut.role = 'owner';
    update ai_credits c
    set monthly_balance = case
          when v_allow > c.monthly_allowance then greatest(c.monthly_balance, v_allow)
          else c.monthly_balance end,
        monthly_allowance = v_allow,
        updated_at = now()
    where c.user_id = r.user_id;
  end loop;
  return NEW;
exception when others then
  return NEW;
end; $function$;
