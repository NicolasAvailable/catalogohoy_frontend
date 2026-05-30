-- RPC para banear (o desbanear) a todos los dueños de un tenant desde el
-- panel interno. Setea `auth.users.banned_until = 'infinity'` para bloquear el
-- login, o `NULL` para reactivar la cuenta.

CREATE OR REPLACE FUNCTION public.set_tenant_owners_banned_admin(
  p_tenant_id BIGINT,
  p_banned BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth
AS $function$
DECLARE
  v_auth_uid UUID;
  v_count INTEGER := 0;
  v_target TIMESTAMPTZ;
BEGIN
  PERFORM public._assert_internal_admin();

  v_target := CASE WHEN p_banned THEN 'infinity'::TIMESTAMPTZ ELSE NULL END;

  FOR v_auth_uid IN
    SELECT u.auth_user_id
      FROM public.users_tenants ut
      JOIN public.users u ON u.id = ut.user_id
     WHERE ut.tenant_id = p_tenant_id
       AND u.auth_user_id IS NOT NULL
  LOOP
    UPDATE auth.users SET banned_until = v_target WHERE id = v_auth_uid;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'banned',    p_banned,
    'users_affected', v_count
  );
END $function$;

REVOKE EXECUTE ON FUNCTION public.set_tenant_owners_banned_admin(BIGINT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_tenant_owners_banned_admin(BIGINT, BOOLEAN) TO authenticated;

-- Checa si los dueños del tenant están actualmente baneados (al menos uno).
CREATE OR REPLACE FUNCTION public.is_tenant_owners_banned_admin(
  p_tenant_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth
AS $function$
DECLARE
  v_banned BOOLEAN := false;
BEGIN
  PERFORM public._assert_internal_admin();

  SELECT EXISTS (
    SELECT 1
      FROM public.users_tenants ut
      JOIN public.users u ON u.id = ut.user_id
      JOIN auth.users au ON au.id = u.auth_user_id
     WHERE ut.tenant_id = p_tenant_id
       AND au.banned_until IS NOT NULL
       AND au.banned_until > now()
  ) INTO v_banned;

  RETURN v_banned;
END $function$;

REVOKE EXECUTE ON FUNCTION public.is_tenant_owners_banned_admin(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_owners_banned_admin(BIGINT) TO authenticated;
