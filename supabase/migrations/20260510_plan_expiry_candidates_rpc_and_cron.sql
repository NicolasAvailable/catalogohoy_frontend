-- RPC that the edge function calls, one threshold at a time. Returns the
-- owner contact info + tenant + branding for the email render. Filters:
--   * plan_id is not 'gratis'
--   * plan_expires_at is exactly N days from today (date_trunc to UTC date)
--   * owner has notify_plan_expiry = true (the toggle in Mi Perfil)
-- One row per (tenant, owner) — if a tenant has multiple owners (rare),
-- each owner gets their own email.
CREATE OR REPLACE FUNCTION public.plan_expiry_candidates(p_days_before INT)
 RETURNS TABLE(
   tenant_id BIGINT,
   tenant_name TEXT,
   slug TEXT,
   custom_domain TEXT,
   plan_id TEXT,
   plan_expires_at TIMESTAMPTZ,
   stripe_subscription_status TEXT,
   logo TEXT,
   theme_color TEXT,
   owner_user_id BIGINT,
   owner_email TEXT,
   owner_name TEXT,
   notify_plan_expiry BOOLEAN
 )
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $$
  SELECT
    t.id              AS tenant_id,
    t.name            AS tenant_name,
    t.slug,
    t.custom_domain,
    t.plan_id,
    t.plan_expires_at,
    t.stripe_subscription_status,
    ec.logo,
    COALESCE(ec.theme_color, '#10b981') AS theme_color,
    u.id              AS owner_user_id,
    u.email           AS owner_email,
    u.name            AS owner_name,
    u.notify_plan_expiry
  FROM public.tenants t
  JOIN public.users_tenants ut ON ut.tenant_id = t.id AND ut.role = 'owner'
  JOIN public.users u ON u.id = ut.user_id
  LEFT JOIN public.tenant_ecommerce_config ec ON ec.tenant_id = t.id
  WHERE t.plan_id IS DISTINCT FROM 'gratis'
    AND t.plan_expires_at IS NOT NULL
    AND DATE(t.plan_expires_at AT TIME ZONE 'UTC') - DATE(now() AT TIME ZONE 'UTC') = p_days_before
$$;

GRANT EXECUTE ON FUNCTION public.plan_expiry_candidates(INT) TO service_role;

-- Schedule the daily cron. 13:00 UTC = 09:00 ART / 09:00 ET / 09:00 VET —
-- early enough in business hours across LATAM that the email lands when
-- the owner is reachable, late enough that any pending Stripe renewal
-- (which fires at the same time of day as the original purchase) had a
-- chance to update plan_expires_at and self-resolve.
SELECT cron.unschedule('send-plan-expiry-warnings-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-plan-expiry-warnings-daily');

SELECT cron.schedule(
  'send-plan-expiry-warnings-daily',
  '0 13 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://yvkurjivijnhliofmfmj.supabase.co/functions/v1/send-plan-expiry-warning',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'whsec_expiry_8a3f2b1e9c5d7046c8e4a1f3b7d2980c'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);
