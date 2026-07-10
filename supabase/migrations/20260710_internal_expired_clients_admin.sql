-- Panel interno · Catálogos activos → tab "Vencidos" histórico.
--
-- `list_paying_clients_admin` filtra por plan_id pago, así que un tenant que
-- venció y fue degradado a `gratis` desaparece de la lista. Este RPC devuelve
-- TODOS los catálogos que alguna vez tuvieron plan pago y hoy no tienen uno
-- vigente:
--   A) plan_id pago con plan_expires_at en el pasado (vencido aún no degradado),
--      excluyendo past_due (esos van en el tab "En gracia").
--   B) plan_id no pago pero con historial en tenant_subscriptions o
--      previous_plan_id (degradados). Al degradar se nullea plan_expires_at,
--      por eso la fecha/ciclo salen de su última suscripción.
-- Los checkouts que nunca completaron el primer pago (incomplete_expired, sin
-- historial ni previous_plan_id) quedan fuera: nunca tuvieron plan.
--
-- Mismo shape de fila que list_paying_clients_admin para reusar el mapping del
-- frontend.

CREATE OR REPLACE FUNCTION public.list_expired_clients_admin()
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
  WITH last_sub AS (
    SELECT DISTINCT ON (ts.tenant_id)
      ts.tenant_id, ts.tier, ts.cycle, ts.started_at, ts.expires_at
    FROM public.tenant_subscriptions ts
    ORDER BY ts.tenant_id, ts.started_at DESC
  )
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    tec.logo AS tenant_logo,
    owner_data.name AS owner_name,
    owner_data.email AS owner_email,
    owner_data.avatar_url AS owner_avatar_url,
    CASE
      WHEN t.plan_id IN ('basico', 'avanzado', 'enterprise') THEN t.plan_id
      ELSE COALESCE(t.previous_plan_id, ls.tier)
    END AS tier,
    ls.cycle AS cycle,
    CASE
      WHEN t.plan_id IN ('basico', 'avanzado', 'enterprise') THEN t.plan_started_at
      ELSE COALESCE(ls.started_at, t.plan_started_at)
    END AS started_at,
    CASE
      WHEN t.plan_id IN ('basico', 'avanzado', 'enterprise') THEN t.plan_expires_at
      ELSE ls.expires_at
    END AS expires_at,
    CASE
      WHEN t.plan_id IN ('basico', 'avanzado', 'enterprise') THEN
        EXTRACT(DAY FROM (t.plan_expires_at - now()))::int
      WHEN ls.expires_at IS NULL THEN NULL
      ELSE EXTRACT(DAY FROM (ls.expires_at - now()))::int
    END AS days_until_expiry,
    t.country_code AS country_code,
    t.stripe_subscription_status AS stripe_subscription_status
  FROM public.tenants t
  LEFT JOIN last_sub ls ON ls.tenant_id = t.id
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
  WHERE
    (
      t.plan_id IN ('basico', 'avanzado', 'enterprise')
      AND t.plan_expires_at IS NOT NULL
      AND t.plan_expires_at < now()
      AND COALESCE(t.stripe_subscription_status, '') <> 'past_due'
    )
    OR
    (
      t.plan_id NOT IN ('basico', 'avanzado', 'enterprise')
      AND (ls.tenant_id IS NOT NULL OR t.previous_plan_id IS NOT NULL)
    )
  ORDER BY 11 DESC NULLS LAST;
END;
$function$;
