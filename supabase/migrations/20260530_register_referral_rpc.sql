-- CAT-6: RPC para registrar el referral pending al momento del signup.
--
-- Llamado desde apps/authentication después de crear el tenant del usuario.
-- Resuelve el código del referente, valida self-referral (por tenant y por
-- email del owner), y crea la fila pending + setea tenants.referred_by_tenant_id.
--
-- Idempotente: si el tenant ya tiene un referral registrado, no hace nada.

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
  v_referrer_email       TEXT;
  v_referred_email       TEXT;
  v_is_owner             BOOLEAN;
  v_existing_referral_id BIGINT;
  v_normalized_code      TEXT;
BEGIN
  -- Solo el owner del tenant referido puede registrar SU referido.
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

  -- Si ya hay referral registrado para este tenant, ack y salir.
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

  -- Resolver el código contra los tenants.
  SELECT id INTO v_referrer_tenant_id
    FROM tenants
   WHERE referral_code = v_normalized_code
   LIMIT 1;

  IF v_referrer_tenant_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_code', 'code', v_normalized_code);
  END IF;

  -- Anti-fraude inline: self-referral por tenant_id directo (improbable pero
  -- por las dudas — alguien usa SU propio código).
  IF v_referrer_tenant_id = p_referred_tenant_id THEN
    RETURN jsonb_build_object('status', 'self_referral_tenant');
  END IF;

  -- Anti-fraude inline: self-referral por email del owner.
  SELECT u.email INTO v_referrer_email
    FROM users_tenants ut JOIN users u ON u.id = ut.user_id
   WHERE ut.tenant_id = v_referrer_tenant_id AND ut.role = 'owner'
   LIMIT 1;
  SELECT u.email INTO v_referred_email
    FROM users_tenants ut JOIN users u ON u.id = ut.user_id
   WHERE ut.tenant_id = p_referred_tenant_id AND ut.role = 'owner'
   LIMIT 1;

  IF v_referrer_email IS NOT NULL
     AND lower(v_referrer_email) = lower(coalesce(v_referred_email, '')) THEN
    RETURN jsonb_build_object('status', 'self_referral_email');
  END IF;

  -- Todo OK, registrar.
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

REVOKE EXECUTE ON FUNCTION public.register_referral(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_referral(TEXT, BIGINT) TO authenticated;
