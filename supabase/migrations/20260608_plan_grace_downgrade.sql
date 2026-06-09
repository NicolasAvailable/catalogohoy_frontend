-- Plan grace period + auto-downgrade to free (instead of hard-blocking).
--
-- Before: check_expired_plans() flipped plan_expired=true the day a paid plan
-- lapsed, and the app HARD-BLOCKED the admin panel and the public catalog until
-- the customer paid — locking lapsed-but-paying users out of their own data.
--
-- New policy: a 3-day grace window (plan stays active, the admin shows a warning
-- banner), then a DOWNGRADE to the free plan instead of blocking. On the free
-- plan only the first 10 products stay visible (enforced read-side in the app);
-- the rest stay in the DB, just hidden — so re-subscribing restores everything
-- automatically. No data is deleted at any point.

-- 1) Remember the paid tier we downgraded from so the UI can offer "renew to get
--    <plan> back" and a future restore can put them back on the exact tier.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS previous_plan_id text;

-- 2) Extend the existing daily expiry job (cron 'check-expired-plans', 06:00 UTC).
--    Keeps the mark/reset behavior but:
--      (a) never marks free plans as expired (free never expires), and
--      (b) downgrades paid plans expired for more than the 3-day grace window.
CREATE OR REPLACE FUNCTION public.check_expired_plans()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Mark expired paid plans (free plans never expire).
  UPDATE tenants
  SET plan_expired = true
  WHERE plan_expires_at IS NOT NULL
    AND plan_expires_at < now()
    AND plan_expired = false
    AND plan_id <> 'gratis';

  -- Reset plans that were renewed (plan_expires_at extended past now).
  UPDATE tenants
  SET plan_expired = false
  WHERE plan_expires_at IS NOT NULL
    AND plan_expires_at >= now()
    AND plan_expired = true;

  -- Downgrade to free after the 3-day grace window. Stores the prior tier in
  -- previous_plan_id and clears the expiry bookkeeping so it becomes a clean
  -- free-plan account. Products beyond the free limit stay in the DB; the app
  -- only shows the first 10 in the public catalog and locks the rest in admin.
  UPDATE tenants
  SET previous_plan_id = plan_id,
      plan_id          = 'gratis',
      plan_expired     = false,
      plan_expires_at  = NULL
  WHERE plan_id <> 'gratis'
    AND plan_expires_at IS NOT NULL
    AND plan_expires_at < now() - interval '3 days';
END;
$function$;
