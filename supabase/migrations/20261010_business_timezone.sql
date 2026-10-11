-- Zona horaria del negocio para el cálculo de "abierto/cerrado".
--
-- BUG (reporte cliente MX, 2026-10-10): el estado abierto/cerrado del catálogo
-- público se calculaba mal:
--   1) El DÍA de la semana salía de EXTRACT(DOW FROM now()) en la DB (UTC).
--   2) La HORA se comparaba contra la hora LOCAL DEL DISPOSITIVO del visitante
--      (new Date().getHours() en el front).
-- Resultado: un visitante en otra zona horaria —o cerca de medianoche UTC— ve
-- "cerrado" aunque el negocio esté abierto en su ciudad.
--
-- FIX: el horario se calcula contra la zona horaria DEL NEGOCIO.
--   - Nueva columna tenant_ecommerce_config.timezone (IANA, ej "America/Mexico_City").
--   - Backfill desde tenants.country_code (default sensato por país).
--   - get_public_catalog: el día se calcula en la zona del negocio y se expone
--     la timezone para que el front calcule la hora en esa misma zona.

-- ── Helper: zona horaria default por país (capital / más poblada) ──
-- Países multi-zona (MX, US, BR, CL, EC, ES) reciben su zona principal; el
-- dueño puede ajustarla en el editor ("Ubicación y Horario").
create or replace function public.default_timezone_for_country(p_code text)
returns text
language sql
immutable
as $$
  select case upper(coalesce(p_code, ''))
    when 'VE' then 'America/Caracas'
    when 'CO' then 'America/Bogota'
    when 'MX' then 'America/Mexico_City'
    when 'AR' then 'America/Argentina/Buenos_Aires'
    when 'PE' then 'America/Lima'
    when 'EC' then 'America/Guayaquil'
    when 'BO' then 'America/La_Paz'
    when 'GT' then 'America/Guatemala'
    when 'DO' then 'America/Santo_Domingo'
    when 'CL' then 'America/Santiago'
    when 'HN' then 'America/Tegucigalpa'
    when 'PY' then 'America/Asuncion'
    when 'CR' then 'America/Costa_Rica'
    when 'US' then 'America/New_York'
    when 'NI' then 'America/Managua'
    when 'PA' then 'America/Panama'
    when 'SV' then 'America/El_Salvador'
    when 'UY' then 'America/Montevideo'
    when 'BR' then 'America/Sao_Paulo'
    when 'ES' then 'Europe/Madrid'
    when 'HT' then 'America/Port-au-Prince'
    when 'JM' then 'America/Jamaica'
    when 'PR' then 'America/Puerto_Rico'
    when 'BB' then 'America/Barbados'
    when 'BS' then 'America/Nassau'
    when 'GY' then 'America/Guyana'
    when 'SR' then 'America/Paramaribo'
    when 'CA' then 'America/Toronto'
    when 'CU' then 'America/Havana'
    when 'BZ' then 'America/Belize'
    else 'America/Caracas'
  end;
$$;

-- ── Columna + backfill ──
alter table public.tenant_ecommerce_config
  add column if not exists timezone text;

update public.tenant_ecommerce_config c
set timezone = public.default_timezone_for_country(t.country_code)
from public.tenants t
where c.tenant_id = t.id
  and c.timezone is null;

-- ── RPC: día de la semana en la zona del negocio + exponer timezone ──
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
  v_timezone     text;
  v_result       json;
BEGIN
  SELECT id, name, country, country_code
    INTO v_tenant_id, v_tenant_name, v_country, v_country_code
  FROM tenants WHERE slug = p_slug;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('error', 'Tenant not found');
  END IF;

  -- Zona horaria del negocio (fallback por país y último recurso Caracas).
  SELECT COALESCE(
           (SELECT timezone FROM tenant_ecommerce_config WHERE tenant_id = v_tenant_id),
           public.default_timezone_for_country(v_country_code),
           'America/Caracas'
         )
    INTO v_timezone;

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
               default_language, meta_pixel_id,
               tax_rate, tax_label,
               timezone
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
          AND day_of_week = EXTRACT(DOW FROM (now() AT TIME ZONE v_timezone))
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

-- Catálogos NUEVOS: el trigger de seed ahora setea la timezone desde el país
-- del tenant (los existentes ya quedaron backfilleados arriba).
create or replace function public.seed_tenant_ecommerce_config()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into tenant_ecommerce_config (tenant_id, timezone)
  values (new.id, public.default_timezone_for_country(new.country_code))
  on conflict (tenant_id) do nothing;
  return new;
exception when others then
  -- Defensivo: sembrar la config nunca debe bloquear la creación del tenant.
  return new;
end $$;
