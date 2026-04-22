-- =========================================================
-- Country + currency internationalization (100% ADDITIVE)
-- =========================================================
-- GUARANTEES:
--   * Idempotent (safe to re-run)
--   * No data backfill (handled in application code)
--   * No column renames or drops
--   * get_public_catalog preserves every existing field exactly;
--     new fields are added alongside. Old clients keep working.
--   * No new endpoints on the public catalog hot path — the
--     single RPC call continues to return everything in one round-trip.
-- =========================================================

-- 1. tenants.country — human-readable country name
--    (country_code already exists; adding the name makes editor UX easier)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS country text;

-- 2. RPC: update_tenant_country — called once after signup by the
--    authenticated user to persist the detected geo country.
CREATE OR REPLACE FUNCTION public.update_tenant_country(
  p_country text,
  p_country_code text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id bigint;
BEGIN
  SELECT ut.tenant_id
    INTO v_tenant_id
    FROM public.users_tenants ut
    JOIN public.users u ON u.id = ut.user_id
   WHERE u.auth_user_id = auth.uid()
     AND ut.is_default = true
   LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_not_found';
  END IF;

  UPDATE public.tenants
     SET country = p_country,
         country_code = p_country_code,
         updated_at = now()
   WHERE id = v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_tenant_country(text, text) TO authenticated;


-- 3. get_public_catalog — additive replacement.
--    Every field from the previous version is preserved byte-for-byte
--    in the same shape. New fields:
--      - tenant.country, tenant.country_code
--      - config.state, config.city, config.show_location_section
--      - currency_config (new top-level key, null when tenant has no row)
CREATE OR REPLACE FUNCTION public.get_public_catalog(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_tenant_id    bigint;
  v_tenant_name  text;
  v_country      text;
  v_country_code text;
  v_result       json;
BEGIN
  SELECT id, name, country, country_code
    INTO v_tenant_id, v_tenant_name, v_country, v_country_code
  FROM tenants WHERE slug = p_slug;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('error', 'Tenant not found');
  END IF;

  SELECT json_build_object(
    'tenant', json_build_object(
      'id', v_tenant_id,
      'name', v_tenant_name,
      'country', v_country,
      'country_code', v_country_code
    ),
    'config', (
      SELECT row_to_json(c) FROM (
        SELECT whatsapp_buttons, logo, banner, is_accepting_orders,
               theme_color, show_design_section, show_payment_methods_section,
               description, social_links, template, currency_symbol,
               whatsapp_order_message,
               state, city, show_location_section
        FROM tenant_ecommerce_config
        WHERE tenant_id = v_tenant_id
      ) c
    ),
    'currency_config', (
      SELECT row_to_json(cc) FROM (
        SELECT product_currency, display_currency, exchange_rate_type,
               custom_rate, show_dual_currency, currency_symbol,
               decimal_separator, thousand_separator
        FROM tenant_currency_config
        WHERE tenant_id = v_tenant_id
      ) cc
    ),
    'payment_methods', COALESCE((
      SELECT json_agg(row_to_json(pm))
      FROM (
        SELECT id, tenant_id, name, icon, is_active, created_at
        FROM payment_methods
        WHERE tenant_id = v_tenant_id AND is_active = true
        ORDER BY created_at ASC
      ) pm
    ), '[]'::json),
    'business_hours', (
      SELECT row_to_json(h) FROM (
        SELECT open_time, close_time, is_open
        FROM tenant_business_hours
        WHERE tenant_id = v_tenant_id
          AND day_of_week = EXTRACT(DOW FROM now())
      ) h
    ),
    'categories', COALESCE((
      SELECT json_agg(row_to_json(cat))
      FROM (
        SELECT id, name
        FROM categories
        WHERE tenant_id = v_tenant_id AND is_visible = true
        ORDER BY position ASC
      ) cat
    ), '[]'::json),
    'exchange_rate', (
      SELECT row_to_json(er) FROM (
        SELECT bcv_usd, bcv_eur, custom_rate, active_rate
        FROM exchange_rates WHERE id = 1
      ) er
    ),
    'plan', (
      SELECT row_to_json(p) FROM (
        SELECT t.plan_expired, COALESCE(pl.is_free, true) AS is_free
        FROM tenants t
        LEFT JOIN plans pl ON pl.id = t.plan_id
        WHERE t.id = v_tenant_id
      ) p
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
