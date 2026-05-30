-- Endurecer el check de self-referral en register_referral: tenants pueden
-- tener múltiples owners. El check debe ser "el caller (referred owner)
-- comparte email con cualquier owner del referrer", no solo con el primero
-- (que la versión anterior elegía con LIMIT 1).

CREATE OR REPLACE FUNCTION public.register_referral(
  p_code TEXT,
  p_referred_tenant_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_referrer_tenant_id   BIGINT;
  v_is_owner             BOOLEAN;
  v_existing_referral_id BIGINT;
  v_normalized_code      TEXT;
  v_self_overlap         BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM users_tenants ut
    JOIN users u ON u.id = ut.user_id
    WHERE ut.tenant_id = p_referred_tenant_id
      AND ut.role = 'owner'
      AND u.auth_user_id = auth.uid()
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'unauthorized: caller is not owner of tenant %', p_referred_tenant_id;
  END IF;

  SELECT id INTO v_existing_referral_id
    FROM referrals
   WHERE referred_tenant_id = p_referred_tenant_id;
  IF v_existing_referral_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_registered',
      'referral_id', v_existing_referral_id
    );
  END IF;

  v_normalized_code := upper(trim(coalesce(p_code, '')));
  IF v_normalized_code = '' THEN
    RETURN jsonb_build_object('status', 'no_code');
  END IF;

  SELECT id INTO v_referrer_tenant_id
    FROM tenants
   WHERE referral_code = v_normalized_code
   LIMIT 1;

  IF v_referrer_tenant_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_code', 'code', v_normalized_code);
  END IF;

  IF v_referrer_tenant_id = p_referred_tenant_id THEN
    RETURN jsonb_build_object('status', 'self_referral_tenant');
  END IF;

  -- Self-referral por email: cualquier owner del referrer comparte email
  -- con cualquier owner del referido. Más robusto que comparar solo los
  -- "primeros" (los tenants pueden tener múltiples owners co-asignados).
  SELECT EXISTS (
    SELECT 1
      FROM users_tenants ut_a
      JOIN users u_a ON u_a.id = ut_a.user_id
      JOIN users_tenants ut_b ON ut_b.tenant_id = p_referred_tenant_id AND ut_b.role = 'owner'
      JOIN users u_b ON u_b.id = ut_b.user_id
     WHERE ut_a.tenant_id = v_referrer_tenant_id
       AND ut_a.role = 'owner'
       AND u_a.email IS NOT NULL
       AND u_b.email IS NOT NULL
       AND lower(u_a.email) = lower(u_b.email)
  ) INTO v_self_overlap;

  IF v_self_overlap THEN
    RETURN jsonb_build_object('status', 'self_referral_email');
  END IF;

  INSERT INTO referrals (referrer_tenant_id, referred_tenant_id, status)
  VALUES (v_referrer_tenant_id, p_referred_tenant_id, 'pending');

  UPDATE tenants
     SET referred_by_tenant_id = v_referrer_tenant_id
   WHERE id = p_referred_tenant_id;

  RETURN jsonb_build_object(
    'status', 'registered',
    'referrer_tenant_id', v_referrer_tenant_id
  );
END $function$;
