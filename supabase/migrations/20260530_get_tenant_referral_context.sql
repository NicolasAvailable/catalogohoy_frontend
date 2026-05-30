-- RPC para el internal admin: cuando el admin abre "Asignar plan" de un
-- tenant, queremos mostrar (a) si fue referido y por quién, y (b) cuánto
-- crédito de referidos tiene disponible para consumir en este pago.

CREATE OR REPLACE FUNCTION public.get_tenant_referral_context(
  p_tenant_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_tenant tenants%ROWTYPE;
  v_referrer tenants%ROWTYPE;
  v_referral referrals%ROWTYPE;
BEGIN
  PERFORM public._assert_internal_admin();

  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant not found: %', p_tenant_id;
  END IF;

  IF v_tenant.referred_by_tenant_id IS NOT NULL THEN
    SELECT * INTO v_referrer FROM tenants WHERE id = v_tenant.referred_by_tenant_id;
    SELECT * INTO v_referral
      FROM referrals
     WHERE referred_tenant_id = p_tenant_id
     LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'credit_available_usd', COALESCE(v_tenant.referral_credit_usd, 0),
    'credit_used_usd',      COALESCE(v_tenant.referral_credit_used_usd, 0),
    'is_referred',          v_tenant.referred_by_tenant_id IS NOT NULL,
    'referrer_tenant_id',   v_tenant.referred_by_tenant_id,
    'referrer_name',        v_referrer.name,
    'referrer_slug',        v_referrer.slug,
    'referral_status',      v_referral.status,
    'referral_code',        v_tenant.referral_code
  );
END $function$;

REVOKE EXECUTE ON FUNCTION public.get_tenant_referral_context(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_referral_context(BIGINT) TO authenticated;
