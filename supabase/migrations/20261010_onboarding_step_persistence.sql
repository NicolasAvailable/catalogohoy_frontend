-- Persistencia del progreso del wizard de onboarding (CAT-49, rama feat/onboarding-v2).
-- NULL = sin onboarding pendiente (tenants legacy o wizard completado);
-- 0..2 = pendiente, retomar en ese paso. Aplicada a prod vía MCP el 2026-10-10.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS onboarding_step smallint;

CREATE OR REPLACE FUNCTION public.get_my_onboarding_step()
RETURNS smallint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  select t.onboarding_step
  from users u
  join users_tenants ut on ut.user_id = u.id
  join tenants t on t.id = ut.tenant_id
  where u.auth_user_id = auth.uid()
  order by ut.is_default desc, (ut.role = 'owner') desc
  limit 1;
$$;

CREATE OR REPLACE FUNCTION public.set_my_onboarding_step(p_step smallint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id bigint;
BEGIN
  IF p_step IS NOT NULL AND (p_step < 0 OR p_step > 10) THEN
    RAISE EXCEPTION 'invalid onboarding step %', p_step;
  END IF;

  SELECT t.id INTO v_tenant_id
  FROM users u
  JOIN users_tenants ut ON ut.user_id = u.id
  JOIN tenants t ON t.id = ut.tenant_id
  WHERE u.auth_user_id = auth.uid()
  ORDER BY ut.is_default DESC, (ut.role = 'owner') DESC
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE tenants SET onboarding_step = p_step WHERE id = v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_onboarding_step() FROM anon;
REVOKE ALL ON FUNCTION public.set_my_onboarding_step(smallint) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_onboarding_step() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_onboarding_step(smallint) TO authenticated;
