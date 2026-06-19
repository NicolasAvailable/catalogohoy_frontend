-- =============================================================================
-- Sistema de descuentos / cupones
-- Tabla tenant_discounts (todos los tipos) + columnas de descuento en orders +
-- trigger de uso + RPC validate_discount_code + get_public_catalog extendido
-- con la clave 'discounts' (reglas automáticas; los códigos NO se exponen).
--
-- Aplicada a prod el 2026-06-19. La política RLS usa el patrón
-- users_tenants -> users.auth_user_id = auth.uid() (users_tenants.user_id es
-- bigint que referencia users.id, no el uuid de auth).
-- =============================================================================

-- 1) Tabla de reglas de descuento por tenant -----------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_discounts (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id     bigint NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          text   NOT NULL,
  type          text   NOT NULL CHECK (type IN (
                  'code','automatic','order_value','package','bogo',
                  'free_shipping','first_purchase')),
  code          text,
  value_type    text   CHECK (value_type IN ('percent','fixed')),
  value         numeric(12,2) NOT NULL DEFAULT 0,
  min_order     numeric(12,2) NOT NULL DEFAULT 0,
  min_items     int    NOT NULL DEFAULT 0,
  free_shipping boolean NOT NULL DEFAULT false,
  bogo_buy      jsonb,
  bogo_get      jsonb,
  usage_limit   int,
  usage_count   int    NOT NULL DEFAULT 0,
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean NOT NULL DEFAULT true,
  position      int    NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_discounts_tenant_id_idx
  ON public.tenant_discounts (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_discounts_tenant_code_uniq
  ON public.tenant_discounts (tenant_id, lower(code))
  WHERE code IS NOT NULL;

ALTER TABLE public.tenant_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_discounts_tenant_all ON public.tenant_discounts;
CREATE POLICY tenant_discounts_tenant_all ON public.tenant_discounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.users_tenants ut
      JOIN public.users u ON u.id = ut.user_id
      WHERE ut.tenant_id = tenant_discounts.tenant_id
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users_tenants ut
      JOIN public.users u ON u.id = ut.user_id
      WHERE ut.tenant_id = tenant_discounts.tenant_id
        AND u.auth_user_id = auth.uid()
    )
  );

REVOKE ALL ON public.tenant_discounts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_discounts TO authenticated;

-- 2) Columnas de descuento en orders ------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_code   text,
  ADD COLUMN IF NOT EXISTS discount_label  text;

-- 3) Trigger: incrementar usage_count al crear una orden con código ------------
CREATE OR REPLACE FUNCTION public.increment_discount_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.discount_code IS NOT NULL AND NEW.tenant_id IS NOT NULL THEN
    UPDATE public.tenant_discounts
       SET usage_count = usage_count + 1,
           updated_at  = now()
     WHERE tenant_id = NEW.tenant_id
       AND lower(code) = lower(NEW.discount_code);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_discount_usage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_increment_discount_usage ON public.orders;
CREATE TRIGGER trg_increment_discount_usage
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_discount_usage();

-- 4) RPC: validar un código de descuento (público) ----------------------------
CREATE OR REPLACE FUNCTION public.validate_discount_code(
  p_slug     text,
  p_code     text,
  p_subtotal numeric,
  p_phone    text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id bigint;
  v_d         public.tenant_discounts%ROWTYPE;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = p_slug;
  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'not_found');
  END IF;

  SELECT * INTO v_d
  FROM public.tenant_discounts
  WHERE tenant_id = v_tenant_id
    AND type = 'code'
    AND code IS NOT NULL
    AND lower(code) = lower(trim(p_code))
    AND is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >= now())
  LIMIT 1;

  IF v_d.id IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'not_found');
  END IF;

  IF v_d.usage_limit IS NOT NULL AND v_d.usage_count >= v_d.usage_limit THEN
    RETURN json_build_object('valid', false, 'error', 'usage_limit');
  END IF;

  IF p_subtotal < v_d.min_order THEN
    RETURN json_build_object('valid', false, 'error', 'min_order',
                             'min_order', v_d.min_order);
  END IF;

  RETURN json_build_object(
    'valid', true,
    'id', v_d.id,
    'name', v_d.name,
    'code', v_d.code,
    'value_type', v_d.value_type,
    'value', v_d.value,
    'free_shipping', v_d.free_shipping
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_discount_code(text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(text, text, numeric, text) TO anon, authenticated;

-- 5) get_public_catalog: agregar la clave 'discounts' (reglas no-código activas)
--    Cuerpo copiado de la función viva (pg_get_functiondef) + clave 'discounts'.
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
