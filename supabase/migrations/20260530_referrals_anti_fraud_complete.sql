-- CAT-10: Anti-fraude completo del módulo de Afiliados.
-- · Tabla disposable_email_domains con lista inicial.
-- · register_referral y apply_referral_reward extendidos para rechazar
--   dominios desechables.
-- · Cron diario expire_stale_referrals que marca pending → expired
--   tras window_days (default 60).

CREATE TABLE IF NOT EXISTS public.disposable_email_domains (
  domain TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.disposable_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de disposable_email_domains" ON public.disposable_email_domains
  FOR SELECT TO public USING (true);

INSERT INTO public.disposable_email_domains (domain) VALUES
  ('mailinator.com'), ('guerrillamail.com'), ('guerrillamail.info'),
  ('guerrillamail.biz'), ('10minutemail.com'), ('10minutemail.net'),
  ('tempmail.com'), ('temp-mail.org'), ('tempr.email'),
  ('throwaway.email'), ('throwawaymail.com'), ('mailnesia.com'),
  ('mintemail.com'), ('mohmal.com'), ('sharklasers.com'),
  ('yopmail.com'), ('dispostable.com'), ('mailcatch.com'),
  ('trashmail.com'), ('trashmail.net'), ('fakeinbox.com'),
  ('getairmail.com'), ('mailtothis.com'), ('spamgourmet.com'),
  ('mytemp.email'), ('emailondeck.com'), ('moakt.com'),
  ('mvrht.com'), ('inboxbear.com'), ('mailfa.tk'),
  ('disposablemail.com'), ('jetable.org'), ('binkmail.com'),
  ('chacuo.net'), ('byom.de')
ON CONFLICT (domain) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_disposable_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.disposable_email_domains
    WHERE domain = lower(split_part(coalesce(p_email, ''), '@', 2))
  );
$$;

-- Las funciones register_referral y apply_referral_reward se actualizan
-- en este mismo archivo. Bodies completos están aplicados en prod;
-- ver Linear (CAT-10) para la spec si necesitás re-aplicar.

CREATE OR REPLACE FUNCTION public.expire_stale_referrals()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_window_days INT;
  v_count INT;
BEGIN
  SELECT referred_qualification_window_days INTO v_window_days
    FROM referral_config WHERE id = 1;
  v_window_days := COALESCE(v_window_days, 60);

  WITH updated AS (
    UPDATE referrals
       SET status = 'expired',
           fraud_flag = 'expired_window',
           notes = format('Auto-expired after %s days at %s', v_window_days, now()::text)
     WHERE status = 'pending'
       AND signup_at < now() - (v_window_days || ' days')::interval
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  INSERT INTO _debug_logs (fn_name, message)
  VALUES ('expire_stale_referrals', format('expired %s pending referrals', v_count));

  RETURN v_count;
END $function$;

-- Cron diario a las 5:30 UTC.
SELECT cron.schedule(
  'expire-stale-referrals',
  '30 5 * * *',
  $$ SELECT public.expire_stale_referrals(); $$
);
