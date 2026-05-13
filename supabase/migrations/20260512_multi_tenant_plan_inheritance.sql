-- Fix multi-tenant plan inheritance. Three problems addressed:
--
-- 1. `create_catalog_for_user` defaulted new tenants to plan_id='gratis',
--    so a paid user's second catalog silently lost premium features.
-- 2. The slot-limit check used `max_catalogs` only, ignoring add-on slots
--    bought via Stripe (`extra_catalogs`). After buying an extra catalog,
--    the RPC still raised `no_remaining_catalogs`.
-- 3. `extra_catalogs` is per-tenant in the schema but logically per-user;
--    we now sum across every tenant the caller owns so the check matches
--    the actual quota.
--
-- Inheritance copies plan_id, plan_expires_at, plan_expired and
-- stripe_subscription_status from the user's primary owned tenant.
-- stripe_subscription_id is intentionally NOT copied so the webhook keeps
-- a single source of truth.

CREATE OR REPLACE FUNCTION public.create_catalog_for_user(p_name text, p_slug text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id              bigint;
  v_owned_count          integer;
  v_total_extras         integer;
  v_max_catalogs         integer;
  v_primary_tenant_id    bigint;
  v_primary_plan_id      text;
  v_primary_plan_expires timestamptz;
  v_primary_plan_expired boolean;
  v_primary_sub_status   text;
  v_new_tenant_id        bigint;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE auth_user_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT
    COUNT(*),
    COALESCE(SUM(t.extra_catalogs), 0)
  INTO v_owned_count, v_total_extras
  FROM users_tenants ut
  JOIN tenants t ON t.id = ut.tenant_id
  WHERE ut.user_id = v_user_id AND ut.role = 'owner';

  SELECT t.id, t.plan_id, t.plan_expires_at, t.plan_expired, t.stripe_subscription_status
  INTO v_primary_tenant_id, v_primary_plan_id, v_primary_plan_expires,
       v_primary_plan_expired, v_primary_sub_status
  FROM tenants t
  JOIN users_tenants ut ON ut.tenant_id = t.id
  WHERE ut.user_id = v_user_id AND ut.role = 'owner'
  ORDER BY ut.is_default DESC, t.created_at ASC
  LIMIT 1;

  IF v_owned_count > 0 THEN
    SELECT max_catalogs INTO v_max_catalogs
    FROM plans
    WHERE id = v_primary_plan_id;

    IF v_owned_count >= (COALESCE(v_max_catalogs, 1) + COALESCE(v_total_extras, 0)) THEN
      RAISE EXCEPTION 'no_remaining_catalogs';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'slug_taken';
  END IF;

  INSERT INTO tenants (
    name,
    slug,
    country_code,
    plan_id,
    plan_expires_at,
    plan_expired,
    stripe_subscription_status
  )
  VALUES (
    p_name,
    p_slug,
    'VE',
    COALESCE(v_primary_plan_id, 'gratis'),
    v_primary_plan_expires,
    COALESCE(v_primary_plan_expired, false),
    v_primary_sub_status
  )
  RETURNING id INTO v_new_tenant_id;

  INSERT INTO users_tenants (user_id, tenant_id, role, is_default)
  VALUES (v_user_id, v_new_tenant_id, 'owner', false);

  INSERT INTO tenant_ecommerce_config (id, tenant_id)
  VALUES (v_new_tenant_id, v_new_tenant_id);

  PERFORM public._seed_default_view_all_category(v_new_tenant_id, auth.uid());

  RETURN json_build_object(
    'id',   v_new_tenant_id,
    'name', p_name,
    'slug', p_slug
  );
END;
$function$;

-- Backfill: secondaries whose owner has a paid primary inherit it now.
-- Both pre-existing multi-tenant users (Nicolas, Andrea) were on this
-- pattern and were silently downgraded to 'gratis' on their secondaries.
WITH primary_per_user AS (
  SELECT DISTINCT ON (ut.user_id)
    ut.user_id,
    t.id AS primary_tenant_id,
    t.plan_id,
    t.plan_expires_at,
    t.plan_expired,
    t.stripe_subscription_status
  FROM users_tenants ut
  JOIN tenants t ON t.id = ut.tenant_id
  WHERE ut.role = 'owner'
  ORDER BY ut.user_id, ut.is_default DESC, t.created_at ASC
),
secondary_to_fix AS (
  SELECT
    t.id AS tenant_id,
    p.plan_id   AS new_plan_id,
    p.plan_expires_at,
    p.plan_expired,
    p.stripe_subscription_status
  FROM users_tenants ut
  JOIN tenants t ON t.id = ut.tenant_id
  JOIN primary_per_user p ON p.user_id = ut.user_id
  WHERE ut.role = 'owner'
    AND t.id != p.primary_tenant_id
    AND p.plan_id != 'gratis'
    AND t.plan_id = 'gratis'
)
UPDATE tenants t
SET plan_id                    = s.new_plan_id,
    plan_expires_at            = s.plan_expires_at,
    plan_expired               = s.plan_expired,
    stripe_subscription_status = s.stripe_subscription_status,
    updated_at                 = NOW()
FROM secondary_to_fix s
WHERE t.id = s.tenant_id;
