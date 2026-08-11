-- Internal admin lists: server-side search + pagination + total_count.
--
-- Motivo: el panel interno cargaba listas completas vía RPC, pero PostgREST
-- corta la respuesta en 1000 filas por defecto. Con >2000 tenants/users, los
-- registros viejos quedaban invisibles (y el buscador solo filtraba lo cargado
-- en memoria). Ahora cada RPC recibe (p_search, p_limit, p_offset), filtra en
-- SQL y devuelve total_count (COUNT(*) OVER()) para paginar/mostrar "X de Y".
--
-- Backward-compatible: los params tienen DEFAULT, así que una llamada sin
-- argumentos sigue funcionando (primeras N por recencia). Se conserva el gate
-- de autorización original de cada función.

-- ===========================================================================
-- 1) list_all_tenants_admin  (catálogos)
-- ===========================================================================
DROP FUNCTION IF EXISTS public.list_all_tenants_admin();

CREATE FUNCTION public.list_all_tenants_admin(
  p_search text DEFAULT NULL,
  p_limit  integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id bigint, name text, slug text, country_code text, logo text,
  owner_name text, owner_email text, created_at timestamptz, plan_id text,
  plan_started_at timestamptz, plan_expires_at timestamptz, plan_expired boolean,
  plan_cycle text, extra_catalogs integer, total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_term text := NULLIF(TRIM(COALESCE(p_search, '')), '');
  v_like text := '%' || v_term || '%';
BEGIN
  PERFORM public._assert_internal_admin();

  RETURN QUERY
  WITH base AS (
    SELECT
      t.id, t.name, t.slug, t.country_code, tec.logo,
      owner_data.name  AS owner_name,
      owner_data.email AS owner_email,
      t.created_at, t.plan_id, t.plan_started_at, t.plan_expires_at, t.plan_expired,
      (
        SELECT ts.cycle FROM public.tenant_subscriptions ts
        WHERE ts.tenant_id = t.id AND ts.status = 'active'
        ORDER BY ts.started_at DESC LIMIT 1
      ) AS plan_cycle,
      COALESCE(t.extra_catalogs, 0)::integer AS extra_catalogs
    FROM public.tenants t
    LEFT JOIN public.tenant_ecommerce_config tec ON tec.tenant_id = t.id
    LEFT JOIN LATERAL (
      SELECT TRIM(CONCAT_WS(' ', u.name, u.last_name)) AS name, u.email
      FROM public.users_tenants ut
      JOIN public.users u ON u.id = ut.user_id
      WHERE ut.tenant_id = t.id
      ORDER BY ut.is_default DESC NULLS LAST, (ut.role = 'owner') DESC, ut.id ASC
      LIMIT 1
    ) owner_data ON true
  )
  SELECT b.id, b.name, b.slug, b.country_code, b.logo, b.owner_name, b.owner_email,
         b.created_at, b.plan_id, b.plan_started_at, b.plan_expires_at, b.plan_expired,
         b.plan_cycle, b.extra_catalogs,
         COUNT(*) OVER() AS total_count
  FROM base b
  WHERE v_term IS NULL
     OR b.name ILIKE v_like
     OR b.slug ILIKE v_like
     OR b.owner_name ILIKE v_like
     OR b.owner_email ILIKE v_like
  ORDER BY b.created_at DESC
  LIMIT  GREATEST(COALESCE(p_limit, 1000), 0)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

-- ===========================================================================
-- 2) list_all_users_admin  (usuarios)
-- ===========================================================================
DROP FUNCTION IF EXISTS public.list_all_users_admin();

CREATE FUNCTION public.list_all_users_admin(
  p_search text DEFAULT NULL,
  p_limit  integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id bigint, name text, last_name text, email text, phone text,
  avatar_url text, created_at timestamptz, total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_term text := NULLIF(TRIM(COALESCE(p_search, '')), '');
  v_like text := '%' || v_term || '%';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid() AND au.email = 'nicaso3006@gmail.com'
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      u.id, u.name, u.last_name, u.email, u.phone,
      COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture') AS avatar_url,
      u.created_at
    FROM public.users u
    LEFT JOIN auth.users au ON au.id = u.auth_user_id
  )
  SELECT b.id, b.name, b.last_name, b.email, b.phone, b.avatar_url, b.created_at,
         COUNT(*) OVER() AS total_count
  FROM base b
  WHERE v_term IS NULL
     OR b.name ILIKE v_like
     OR b.last_name ILIKE v_like
     OR b.email ILIKE v_like
     OR b.phone ILIKE v_like
  ORDER BY b.created_at DESC
  LIMIT  GREATEST(COALESCE(p_limit, 1000), 0)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

-- ===========================================================================
-- 3) list_paying_clients_admin  (catálogos activos / clientes que pagan)
-- ===========================================================================
DROP FUNCTION IF EXISTS public.list_paying_clients_admin();

CREATE FUNCTION public.list_paying_clients_admin(
  p_search text DEFAULT NULL,
  p_limit  integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  tenant_id bigint, tenant_name text, tenant_slug text, tenant_logo text,
  owner_name text, owner_email text, owner_avatar_url text, tier text, cycle text,
  started_at timestamptz, expires_at timestamptz, days_until_expiry integer,
  country_code text, stripe_subscription_status text, total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_term text := NULLIF(TRIM(COALESCE(p_search, '')), '');
  v_like text := '%' || v_term || '%';
BEGIN
  PERFORM public._assert_internal_admin();

  RETURN QUERY
  WITH base AS (
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
        SELECT ts.cycle FROM public.tenant_subscriptions ts
        WHERE ts.tenant_id = t.id AND ts.status = 'active'
        ORDER BY ts.started_at DESC LIMIT 1
      ) AS cycle,
      t.plan_started_at AS started_at,
      t.plan_expires_at AS expires_at,
      CASE WHEN t.plan_expires_at IS NULL THEN NULL
           ELSE EXTRACT(DAY FROM (t.plan_expires_at - now()))::int END AS days_until_expiry,
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
      ORDER BY ut.is_default DESC NULLS LAST, (ut.role = 'owner') DESC, ut.id ASC
      LIMIT 1
    ) owner_data ON true
    WHERE t.plan_id IN ('basico', 'pro', 'avanzado', 'enterprise')
      AND (
        EXISTS (
          SELECT 1 FROM public.tenant_subscriptions ts
          WHERE ts.tenant_id = t.id AND ts.status = 'active'
            AND ts.expires_at IS NOT NULL AND ts.expires_at > now()
        )
        OR (
          COALESCE(t.stripe_subscription_status, '') <> 'canceled'
          AND COALESCE(t.plan_expired, false) = false
          AND (t.plan_expires_at IS NULL OR t.plan_expires_at >= now())
        )
      )
  )
  SELECT b.tenant_id, b.tenant_name, b.tenant_slug, b.tenant_logo, b.owner_name,
         b.owner_email, b.owner_avatar_url, b.tier, b.cycle, b.started_at,
         b.expires_at, b.days_until_expiry, b.country_code, b.stripe_subscription_status,
         COUNT(*) OVER() AS total_count
  FROM base b
  WHERE v_term IS NULL
     OR b.tenant_name ILIKE v_like
     OR b.tenant_slug ILIKE v_like
     OR b.owner_name ILIKE v_like
     OR b.owner_email ILIKE v_like
  ORDER BY b.started_at DESC NULLS LAST
  LIMIT  GREATEST(COALESCE(p_limit, 1000), 0)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

-- ===========================================================================
-- 4) channel_connections_admin  (canales conectados)
-- ===========================================================================
DROP FUNCTION IF EXISTS public.channel_connections_admin();

CREATE FUNCTION public.channel_connections_admin(
  p_search text DEFAULT NULL,
  p_limit  integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  channel text, tenant_id bigint, tenant_name text, tenant_slug text,
  identity text, display_name text, connected_at timestamptz, total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_term text := NULLIF(TRIM(COALESCE(p_search, '')), '');
  v_like text := '%' || v_term || '%';
BEGIN
  IF COALESCE(auth.jwt() ->> 'email', '') NOT IN ('nicaso3006@gmail.com') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT 'whatsapp'::text AS channel, w.tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
           w.phone_number AS identity, w.display_name, w.created_at AS connected_at
    FROM whatsapp_accounts w
    LEFT JOIN tenants t ON t.id = w.tenant_id
    WHERE w.status = 'active'
    UNION ALL
    SELECT s.channel, s.tenant_id, t.name, t.slug,
           s.username, s.display_name, s.created_at
    FROM social_accounts s
    LEFT JOIN tenants t ON t.id = s.tenant_id
    WHERE s.status = 'active'
  )
  SELECT b.channel, b.tenant_id, b.tenant_name, b.tenant_slug, b.identity,
         b.display_name, b.connected_at,
         COUNT(*) OVER() AS total_count
  FROM base b
  WHERE v_term IS NULL
     OR b.tenant_name ILIKE v_like
     OR b.tenant_slug ILIKE v_like
     OR b.identity ILIKE v_like
     OR b.display_name ILIKE v_like
  ORDER BY b.connected_at DESC
  LIMIT  GREATEST(COALESCE(p_limit, 1000), 0)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

-- ===========================================================================
-- 5) list_enterprise_leads_admin  (leads enterprise)
-- ===========================================================================
DROP FUNCTION IF EXISTS public.list_enterprise_leads_admin();

CREATE FUNCTION public.list_enterprise_leads_admin(
  p_search text DEFAULT NULL,
  p_limit  integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id bigint, created_at timestamptz, source text, tenant_slug text, business_name text,
  country text, website text, name text, email text, phone text, products_range text,
  orders_range text, catalogs_needed text, team_size text, needs text[], score integer,
  qualified boolean, status text, total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_term text := NULLIF(TRIM(COALESCE(p_search, '')), '');
  v_like text := '%' || v_term || '%';
BEGIN
  PERFORM public._assert_internal_admin();

  RETURN QUERY
  WITH base AS (
    SELECT l.id, l.created_at, l.source, l.tenant_slug, l.business_name,
           l.country, l.website, l.name, l.email, l.phone, l.products_range,
           l.orders_range, l.catalogs_needed, l.team_size, l.needs, l.score,
           l.qualified, l.status
    FROM public.enterprise_leads l
  )
  SELECT b.id, b.created_at, b.source, b.tenant_slug, b.business_name, b.country,
         b.website, b.name, b.email, b.phone, b.products_range, b.orders_range,
         b.catalogs_needed, b.team_size, b.needs, b.score, b.qualified, b.status,
         COUNT(*) OVER() AS total_count
  FROM base b
  WHERE v_term IS NULL
     OR b.business_name ILIKE v_like
     OR b.name ILIKE v_like
     OR b.email ILIKE v_like
     OR b.tenant_slug ILIKE v_like
     OR b.country ILIKE v_like
  ORDER BY b.created_at DESC
  LIMIT  GREATEST(COALESCE(p_limit, 1000), 0)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;
