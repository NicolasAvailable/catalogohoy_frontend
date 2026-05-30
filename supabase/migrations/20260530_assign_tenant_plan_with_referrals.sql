-- Extender assign_tenant_plan_admin para soportar el módulo de Afiliados:
-- · Si es PRIMER pago del tenant y tiene referral pending → disparar reward
--   automáticamente vía apply_referral_reward (CAT-5).
-- · Si el admin pasa p_consume_credit_usd > 0 → descontar del balance interno
--   del tenant (caso: María paga su renovación y consume su crédito acumulado).

CREATE OR REPLACE FUNCTION public.assign_tenant_plan_admin(
  p_tenant_id bigint,
  p_tier text,
  p_cycle text,
  p_amount_usd numeric DEFAULT NULL::numeric,
  p_payment_method text DEFAULT NULL::text,
  p_payment_reference text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_consume_credit_usd numeric DEFAULT NULL::numeric
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_history_id bigint;
  v_months int;
  v_started timestamptz := now();
  v_expires timestamptz;
  v_current_credit numeric;
  v_prior_subs_count int;
  v_referral_result jsonb;
BEGIN
  PERFORM public._assert_internal_admin();

  IF p_tier NOT IN ('basico', 'avanzado') THEN
    RAISE EXCEPTION 'invalid tier: %', p_tier;
  END IF;

  v_months := CASE p_cycle
    WHEN 'monthly' THEN 1
    WHEN 'quarterly' THEN 3
    WHEN 'annual' THEN 12
    ELSE 1
  END;

  v_expires := v_started + (v_months || ' months')::interval;

  -- Consumo opcional de crédito de referidos.
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

  SELECT COUNT(*) INTO v_prior_subs_count
    FROM public.tenant_subscriptions
   WHERE tenant_id = p_tenant_id;

  UPDATE public.tenants
  SET plan_id = p_tier,
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

  -- Auto-trigger del referral reward en PRIMER pago.
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
