-- "Ver todos" oculto: el catálogo público necesita distinguir entre un tenant
-- SIN fila "Ver todos" (legacy → el front renderiza un tab sintético) y uno que
-- la OCULTÓ (→ ningún tab de Ver todos, pero se muestran todos los productos).
-- Cambio en 'categories': se incluye la fila is_view_all aunque esté oculta y
-- se expone is_visible; el front filtra las visibles y usa la fila oculta solo
-- como señal. Las demás categorías ocultas siguen sin devolverse.
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
               shipping_methods, show_shipping_section, customer_fields,
               default_language
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
        SELECT id, tenant_id, name, icon, is_active, created_at, details
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
        SELECT id, name, is_view_all, is_visible
        FROM categories
        WHERE tenant_id = v_tenant_id
          AND (is_visible = true OR is_view_all = true)
        ORDER BY position ASC
      ) cat
    ), '[]'::json),
    'discounts', COALESCE((
      SELECT json_agg(row_to_json(d))
      FROM (
        SELECT id, name, type, value_type, value, min_order, min_items,
               free_shipping, bogo_buy, bogo_get, position
        FROM tenant_discounts
        WHERE tenant_id = v_tenant_id
          AND type <> 'code'
          AND is_active = true
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at   IS NULL OR ends_at   >= now())
        ORDER BY position ASC
      ) d
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
