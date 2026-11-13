-- Acciones por usuario en el panel interno (Usuarios):
--   * list_all_users_admin ahora devuelve si está baneado, último login,
--     método de registro y los catálogos a los que pertenece.
--   * set_user_banned_admin: banea / desbanea UN usuario (no todo el tenant).
--     Al banear también cierra sus sesiones para sacarlo de inmediato.
--   * sign_out_user_admin: cierra todas las sesiones de un usuario.
-- Sin tablas nuevas (no aplica RLS). Todo gateado por _assert_internal_admin().

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
      au.raw_app_meta_data->>'provider' AS provider
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
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug) ORDER BY t.id)
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

-- Banea (o desbanea) un usuario puntual.
CREATE OR REPLACE FUNCTION public.set_user_banned_admin(
  p_user_id BIGINT,
  p_banned  BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth
AS $function$
DECLARE
  v_auth_uid UUID;
BEGIN
  PERFORM public._assert_internal_admin();

  SELECT u.auth_user_id INTO v_auth_uid FROM public.users u WHERE u.id = p_user_id;
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'user % has no auth account', p_user_id;
  END IF;
  IF v_auth_uid = auth.uid() THEN
    RAISE EXCEPTION 'cannot ban yourself';
  END IF;

  UPDATE auth.users
     SET banned_until = CASE WHEN p_banned THEN 'infinity'::timestamptz ELSE NULL END
   WHERE id = v_auth_uid;

  IF p_banned THEN
    DELETE FROM auth.sessions WHERE user_id = v_auth_uid;
  END IF;

  RETURN jsonb_build_object('user_id', p_user_id, 'banned', p_banned);
END $function$;

REVOKE EXECUTE ON FUNCTION public.set_user_banned_admin(BIGINT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_banned_admin(BIGINT, BOOLEAN) TO authenticated;

-- Cierra todas las sesiones activas de un usuario (lo obliga a volver a entrar).
CREATE OR REPLACE FUNCTION public.sign_out_user_admin(p_user_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth
AS $function$
DECLARE
  v_auth_uid UUID;
  v_count INTEGER;
BEGIN
  PERFORM public._assert_internal_admin();

  SELECT u.auth_user_id INTO v_auth_uid FROM public.users u WHERE u.id = p_user_id;
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'user % has no auth account', p_user_id;
  END IF;

  DELETE FROM auth.sessions WHERE user_id = v_auth_uid;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $function$;

REVOKE EXECUTE ON FUNCTION public.sign_out_user_admin(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_out_user_admin(BIGINT) TO authenticated;
