-- Add stripe_subscription_status to list_paying_clients_admin so the internal
-- "Catálogos activos" panel can surface clients in grace period: their renewal
-- already extended plan_expires_at (past_due is a VALID status in the webhook)
-- but Stripe is still retrying the charge. Without this column those clients
-- are indistinguishable from healthy "Activos".

DROP FUNCTION IF EXISTS public.list_paying_clients_admin();

CREATE FUNCTION public.list_paying_clients_admin()
 RETURNS TABLE(
   tenant_id bigint,
   tenant_name text,
   tenant_slug text,
   tenant_logo text,
   owner_name text,
   owner_email text,
   owner_avatar_url text,
   tier text,
   cycle text,
   started_at timestamp with time zone,
   expires_at timestamp with time zone,
   days_until_expiry integer,
   country_code text,
   stripe_subscription_status text
 )
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
    t.country_code AS country_code,
    t.stripe_subscription_status AS stripe_subscription_status
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

GRANT EXECUTE ON FUNCTION public.list_paying_clients_admin() TO anon, authenticated, service_role;
