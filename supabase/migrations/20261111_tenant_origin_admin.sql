-- Origen de cada cliente para el panel interno: por dónde paga (App Store,
-- Play Store, web/Stripe, manual) y cómo llegó (plataforma de registro,
-- método de login, fuente/medio/campaña UTM, referido).
-- Sin tablas nuevas (no aplica RLS). Todo gateado por _assert_internal_admin().

-- Canal de pago actual de un tenant.
CREATE OR REPLACE FUNCTION public._admin_tenant_pay_source(p_tenant_id bigint)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT CASE
    WHEN t.iap_store IN ('app_store', 'play_store') THEN t.iap_store
    WHEN t.stripe_subscription_id IS NOT NULL THEN 'stripe'
    WHEN EXISTS (
      SELECT 1 FROM public.tenant_subscriptions ts
       WHERE ts.tenant_id = t.id AND ts.status = 'active'
    ) THEN 'manual'
    ELSE NULL
  END
  FROM public.tenants t
  WHERE t.id = p_tenant_id;
$fn$;

REVOKE EXECUTE ON FUNCTION public._admin_tenant_pay_source(bigint) FROM PUBLIC, anon, authenticated;

-- Origen por tenant (lote). El "registro" es el del dueño del catálogo.
CREATE OR REPLACE FUNCTION public.get_tenant_origins_admin(p_tenant_ids bigint[])
RETURNS TABLE(
  tenant_id bigint,
  pay_source text,
  pay_status text,
  manual_payment_method text,
  signup_platform text,
  signup_provider text,
  signup_source text,
  signup_medium text,
  signup_campaign text,
  owner_signup_at timestamptz,
  referred_by_tenant_id bigint,
  referred_by_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM public._assert_internal_admin();

  RETURN QUERY
  SELECT
    t.id,
    public._admin_tenant_pay_source(t.id),
    CASE
      WHEN t.iap_store IS NOT NULL THEN t.iap_subscription_status
      WHEN t.stripe_subscription_id IS NOT NULL THEN t.stripe_subscription_status
      ELSE NULL
    END,
    (SELECT ts.payment_method FROM public.tenant_subscriptions ts
      WHERE ts.tenant_id = t.id AND ts.status = 'active'
      ORDER BY ts.started_at DESC LIMIT 1),
    -- signup_platform solo se guarda desde 2025-12-10 (y solo en las apps):
    -- sin el dato y antes de esa fecha = desconocido; después = web.
    CASE
      WHEN au.raw_user_meta_data ? 'signup_platform' THEN au.raw_user_meta_data->>'signup_platform'
      WHEN au.created_at >= '2025-12-10' THEN 'web'
      ELSE NULL
    END,
    au.raw_app_meta_data->>'provider',
    au.raw_user_meta_data->>'signup_source',
    au.raw_user_meta_data->>'signup_medium',
    au.raw_user_meta_data->>'signup_campaign',
    COALESCE(au.created_at, o.created_at),
    t.referred_by_tenant_id,
    rt.name
  FROM public.tenants t
  LEFT JOIN LATERAL (
    SELECT u.auth_user_id, u.created_at
      FROM public.users_tenants ut
      JOIN public.users u ON u.id = ut.user_id
     WHERE ut.tenant_id = t.id
     ORDER BY (ut.role = 'owner') DESC, ut.created_at ASC
     LIMIT 1
  ) o ON true
  LEFT JOIN auth.users au ON au.id = o.auth_user_id
  LEFT JOIN public.tenants rt ON rt.id = t.referred_by_tenant_id
  WHERE t.id = ANY(p_tenant_ids);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.get_tenant_origins_admin(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_origins_admin(bigint[]) TO authenticated;

-- Usuarios: agrega origen del registro y canal de pago por catálogo.
DROP FUNCTION IF EXISTS public.list_all_users_admin(text, integer, integer);

CREATE FUNCTION public.list_all_users_admin(
  p_search text DEFAULT NULL,
  p_limit  integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id bigint, name text, last_name text, email text, phone text,
  avatar_url text, created_at timestamptz,
  is_banned boolean, last_sign_in_at timestamptz, provider text,
  signup_platform text, signup_source text, signup_medium text, signup_campaign text,
  tenants jsonb,
  total_count bigint
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
      u.id, u.name, u.last_name, u.email, u.phone,
      COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture') AS avatar_url,
      u.created_at,
      (au.banned_until IS NOT NULL AND au.banned_until > now()) AS is_banned,
      au.last_sign_in_at,
      au.raw_app_meta_data->>'provider' AS provider,
      CASE
        WHEN au.raw_user_meta_data ? 'signup_platform' THEN au.raw_user_meta_data->>'signup_platform'
        WHEN au.created_at >= '2025-12-10' THEN 'web'
        ELSE NULL
      END AS signup_platform,
      au.raw_user_meta_data->>'signup_source' AS signup_source,
      au.raw_user_meta_data->>'signup_medium' AS signup_medium,
      au.raw_user_meta_data->>'signup_campaign' AS signup_campaign
    FROM public.users u
    LEFT JOIN auth.users au ON au.id = u.auth_user_id
    WHERE v_term IS NULL
       OR u.name ILIKE v_like
       OR u.last_name ILIKE v_like
       OR u.email ILIKE v_like
       OR u.phone ILIKE v_like
       OR u.id::text = v_term
  ),
  page AS (
    SELECT b.*, COUNT(*) OVER() AS total_count
    FROM base b
    ORDER BY b.created_at DESC
    LIMIT  GREATEST(COALESCE(p_limit, 1000), 0)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  )
  SELECT p.id, p.name, p.last_name, p.email, p.phone, p.avatar_url, p.created_at,
         p.is_banned, p.last_sign_in_at, p.provider,
         p.signup_platform, p.signup_source, p.signup_medium, p.signup_campaign,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'id', t.id, 'name', t.name, 'slug', t.slug,
                    'plan', t.plan_id,
                    'pay_source', public._admin_tenant_pay_source(t.id)
                  ) ORDER BY t.id)
             FROM public.users_tenants ut
             JOIN public.tenants t ON t.id = ut.tenant_id
            WHERE ut.user_id = p.id
         ), '[]'::jsonb) AS tenants,
         p.total_count
  FROM page p
  ORDER BY p.created_at DESC;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.list_all_users_admin(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_all_users_admin(text, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
