-- Foundation del módulo de Afiliados (CAT-5).
--
-- Trae:
--   · Columnas en tenants para el código compartible + balance interno.
--   · Tabla referrals con tracking pending → qualified → rewarded (o expired).
--   · Tabla singleton referral_config con los parámetros tuneables.
--   · RPC get_or_create_referral_code para que cada tenant tenga código lazy.
--   · RPC apply_referral_reward — función shared invocada desde el webhook
--     de Stripe Y desde la confirmación manual de pagos por Pago Móvil
--     (apps/internal). Hace qualify + payout + anti-fraude inline.
--
-- Ver Especificación — Módulo de Afiliados en Linear.

-- ─── Columnas en tenants ─────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_tenant_id BIGINT REFERENCES tenants(id),
  ADD COLUMN IF NOT EXISTS referral_credit_usd NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_credit_used_usd NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN tenants.referral_code IS 'Código compartible único del tenant (lazy, ver get_or_create_referral_code).';
COMMENT ON COLUMN tenants.referred_by_tenant_id IS 'Tenant que refirió a este. NULL si no vino por programa de referidos.';
COMMENT ON COLUMN tenants.referral_credit_usd IS 'Crédito interno acumulado vía referidos qualified. Se consume en Stripe (balance) o en pagos manuales.';
COMMENT ON COLUMN tenants.referral_credit_used_usd IS 'Total consumido históricamente. Solo auditoría.';

-- ─── Tabla referrals ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id                          BIGSERIAL PRIMARY KEY,
  referrer_tenant_id          BIGINT NOT NULL REFERENCES tenants(id),
  referred_tenant_id          BIGINT NOT NULL REFERENCES tenants(id),
  status                      TEXT NOT NULL CHECK (status IN ('pending', 'qualified', 'rewarded', 'expired')),
  referrer_credit_usd         NUMERIC,
  referred_discount_pct       INTEGER,
  referred_payment_method     TEXT,
  referrer_stripe_balance_tx  TEXT,
  referred_stripe_coupon_id   TEXT,
  signup_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualified_at                TIMESTAMPTZ,
  rewarded_at                 TIMESTAMPTZ,
  fraud_flag                  TEXT,
  notes                       TEXT,
  UNIQUE (referred_tenant_id),
  CHECK (referrer_tenant_id != referred_tenant_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_tenant_id);
CREATE INDEX IF NOT EXISTS referrals_status_idx ON referrals(status);
CREATE INDEX IF NOT EXISTS referrals_qualified_at_idx
  ON referrals(qualified_at)
  WHERE status IN ('qualified', 'rewarded');

COMMENT ON TABLE referrals IS 'Programa de referidos. Una fila por par (referente, referido). El flujo es pending → qualified → rewarded (o expired si falla anti-fraude).';

-- ─── referral_config (singleton, parámetros tuneables) ───────────────
CREATE TABLE IF NOT EXISTS referral_config (
  id                                  INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  referrer_credit_usd                 NUMERIC NOT NULL DEFAULT 5,
  referred_discount_pct               INTEGER NOT NULL DEFAULT 20,
  monthly_qualified_cap               INTEGER NOT NULL DEFAULT 10,
  referred_qualification_window_days  INTEGER NOT NULL DEFAULT 60,
  updated_at                          TIMESTAMPTZ DEFAULT now()
);

INSERT INTO referral_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE referral_config IS 'Singleton con los parámetros tuneables del programa de afiliados. Editable sin redeploy.';

-- ─── RPC: get_or_create_referral_code ────────────────────────────────
-- Llamada desde el frontend (Mi Perfil → tab Referidos) cuando el owner
-- abre el panel. Genera el código la primera vez y lo cachea en tenants.
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(p_tenant_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_code TEXT;
  v_is_owner BOOLEAN;
BEGIN
  -- Solo el owner del tenant puede leer/generar su código.
  SELECT EXISTS (
    SELECT 1 FROM users_tenants ut
    JOIN users u ON u.id = ut.user_id
    WHERE ut.tenant_id = p_tenant_id
      AND ut.role = 'owner'
      AND u.auth_user_id = auth.uid()
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'unauthorized: caller is not owner of tenant %', p_tenant_id;
  END IF;

  -- Si ya tiene código, devolverlo.
  SELECT referral_code INTO v_code FROM tenants WHERE id = p_tenant_id;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- Generar con retry en colisión. md5 da 0-9+a-f → 7 chars upper = ~268M
  -- combinaciones, suficiente para nuestra escala con baja prob. de colisión.
  LOOP
    v_code := upper(substring(
      md5(random()::text || clock_timestamp()::text || p_tenant_id::text),
      1, 7
    ));
    BEGIN
      UPDATE tenants SET referral_code = v_code
       WHERE id = p_tenant_id AND referral_code IS NULL;
      IF FOUND THEN
        EXIT;
      END IF;
      -- Otra sesión paralela ya seteó un código: leerlo y salir.
      SELECT referral_code INTO v_code FROM tenants WHERE id = p_tenant_id;
      IF v_code IS NOT NULL THEN
        EXIT;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      -- Otro tenant tomó este código; retry.
      CONTINUE;
    END;
  END LOOP;

  RETURN v_code;
END $function$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_referral_code(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code(BIGINT) TO authenticated;

-- ─── RPC: apply_referral_reward ──────────────────────────────────────
-- Función shared invocada desde:
--   · supabase/functions/stripe-webhook (al detectar primer pago)
--   · apps/internal (al confirmar pago manual por Pago Móvil)
--
-- Hace en una sola transacción:
--   1. Busca el referral pending del tenant referido.
--   2. Aplica anti-fraude inline (self-ref + tope mensual). La lista de
--      emails desechables vendrá en F6 (CAT-10).
--   3. Si pasa → marca qualified + rewarded, suma crédito al referrer.
--   4. Si falla → marca expired con fraud_flag.
--   5. Devuelve JSONB con todo lo que el caller necesita para notificar
--      Discord y, en el caso del webhook de Stripe, aplicar customer balance.
--
-- Se restringe a service_role: la llamada desde el internal admin va por
-- un edge function que corre con service_role key, no directo del cliente.
CREATE OR REPLACE FUNCTION public.apply_referral_reward(
  p_referred_tenant_id BIGINT,
  p_paid_amount_usd    NUMERIC,
  p_payment_method     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_referral             referrals%ROWTYPE;
  v_referrer             tenants%ROWTYPE;
  v_referred             tenants%ROWTYPE;
  v_referrer_owner       RECORD;
  v_referred_owner       RECORD;
  v_config               referral_config%ROWTYPE;
  v_qualified_this_month INT;
  v_fraud_flag           TEXT := NULL;
BEGIN
  -- ① Buscar referral pending. Si no hay, no es un referido (early exit).
  SELECT * INTO v_referral
    FROM referrals
   WHERE referred_tenant_id = p_referred_tenant_id
     AND status = 'pending'
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'no_pending_referral',
      'referred_tenant_id', p_referred_tenant_id
    );
  END IF;

  -- ② Cargar contexto (config + tenants + owner emails)
  SELECT * INTO v_config FROM referral_config WHERE id = 1;
  SELECT * INTO v_referrer FROM tenants WHERE id = v_referral.referrer_tenant_id;
  SELECT * INTO v_referred FROM tenants WHERE id = v_referral.referred_tenant_id;

  SELECT u.email, u.name, u.last_name
    INTO v_referrer_owner
    FROM users_tenants ut
    JOIN users u ON u.id = ut.user_id
   WHERE ut.tenant_id = v_referrer.id AND ut.role = 'owner'
   LIMIT 1;

  SELECT u.email, u.name, u.last_name
    INTO v_referred_owner
    FROM users_tenants ut
    JOIN users u ON u.id = ut.user_id
   WHERE ut.tenant_id = v_referred.id AND ut.role = 'owner'
   LIMIT 1;

  -- ③ Anti-fraude inline
  -- 3a) Self-referral por email
  IF v_referrer_owner.email IS NOT NULL
     AND lower(v_referrer_owner.email) = lower(coalesce(v_referred_owner.email, '')) THEN
    v_fraud_flag := 'self_referral_email';
  END IF;

  -- 3b) Tope mensual del referrer
  IF v_fraud_flag IS NULL THEN
    SELECT COUNT(*) INTO v_qualified_this_month
      FROM referrals
     WHERE referrer_tenant_id = v_referral.referrer_tenant_id
       AND status IN ('qualified', 'rewarded')
       AND qualified_at >= date_trunc('month', now());

    IF v_qualified_this_month >= v_config.monthly_qualified_cap THEN
      v_fraud_flag := 'over_monthly_cap';
    END IF;
  END IF;

  -- ④ Aplicar fraude o reward
  IF v_fraud_flag IS NOT NULL THEN
    UPDATE referrals
       SET status = 'expired',
           fraud_flag = v_fraud_flag,
           referred_payment_method = p_payment_method,
           notes = format('Auto-flagged %s at %s', v_fraud_flag, now()::text)
     WHERE id = v_referral.id
     RETURNING * INTO v_referral;
  ELSE
    -- Qualify + reward en una sola UPDATE (atómico, mismas timestamps OK).
    UPDATE referrals
       SET status = 'rewarded',
           qualified_at = now(),
           rewarded_at = now(),
           referrer_credit_usd = v_config.referrer_credit_usd,
           referred_discount_pct = v_config.referred_discount_pct,
           referred_payment_method = p_payment_method
     WHERE id = v_referral.id
     RETURNING * INTO v_referral;

    -- Acreditar al referrer en su balance interno.
    UPDATE tenants
       SET referral_credit_usd = referral_credit_usd + v_config.referrer_credit_usd
     WHERE id = v_referrer.id;
  END IF;

  -- ⑤ Log para auditoría
  INSERT INTO _debug_logs (fn_name, message)
  VALUES (
    'apply_referral_reward',
    format(
      'referral_id=%s status=%s fraud_flag=%s referrer=%s referred=%s amount=%s method=%s',
      v_referral.id,
      v_referral.status,
      COALESCE(v_fraud_flag, '-'),
      v_referrer.slug,
      v_referred.slug,
      p_paid_amount_usd,
      p_payment_method
    )
  );

  -- ⑥ Devolver todo lo que el caller necesita
  RETURN jsonb_build_object(
    'status',                       v_referral.status,
    'fraud_flag',                   v_fraud_flag,
    'referral_id',                  v_referral.id,
    'referrer_tenant_id',           v_referrer.id,
    'referrer_slug',                v_referrer.slug,
    'referrer_name',                v_referrer.name,
    'referrer_email',               v_referrer_owner.email,
    'referrer_stripe_customer_id',  v_referrer.stripe_customer_id,
    'referrer_credit_usd_awarded',  CASE
                                      WHEN v_referral.status = 'rewarded'
                                      THEN v_config.referrer_credit_usd
                                      ELSE 0
                                    END,
    'referred_tenant_id',           v_referred.id,
    'referred_slug',                v_referred.slug,
    'referred_name',                v_referred.name,
    'referred_email',               v_referred_owner.email,
    'paid_amount_usd',              p_paid_amount_usd,
    'payment_method',               p_payment_method
  );
END $function$;

REVOKE EXECUTE ON FUNCTION public.apply_referral_reward(BIGINT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_referral_reward(BIGINT, NUMERIC, TEXT) TO service_role;

-- ─── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Owners pueden leer SUS referrals (los que dieron O los que recibieron).
-- INSERT/UPDATE/DELETE no tienen política → bloqueados por default (solo
-- vía RPCs SECURITY DEFINER que corren con privilegios elevados).
CREATE POLICY "Owners pueden leer sus referrals" ON referrals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants ut
      JOIN users u ON u.id = ut.user_id
      WHERE ut.tenant_id IN (referrer_tenant_id, referred_tenant_id)
        AND ut.role = 'owner'
        AND u.auth_user_id = auth.uid()
    )
  );

-- referral_config: lectura pública (la lib referral del frontend lee los
-- montos para mostrarlos al usuario); escritura solo service_role.
ALTER TABLE referral_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de referral_config" ON referral_config
  FOR SELECT TO public USING (true);
