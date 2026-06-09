-- Extend get_public_catalog to expose the new shipping + customer-field config
-- to the public storefront.
--
-- IMPORTANT (RPC drift): this re-declaration is based on the LIVE function
-- definition (pg_get_functiondef) captured from prod, NOT on the prior repo
-- migration (which had drifted behind). The ONLY change vs. live is the three
-- columns added to the `config` sub-select: shipping_methods,
-- show_shipping_section, customer_fields. Signature, SECURITY DEFINER and every
-- other selected column are preserved verbatim.

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
               show_categories_section,
               show_reference_price, show_local_currency_price,
               description, social_links, template, currency_symbol,
               whatsapp_order_message,
               state, city, show_location_section,
               shipping_methods, show_shipping_section, customer_fields
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
        SELECT id, name, is_view_all
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
