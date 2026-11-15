-- Panel interno → Uso del editor: métricas de adopción del editor de diseño
-- nuevo (CAT-103, temas). Una tienda "usa el editor" cuando guardó
-- `tenant_ecommerce_config.design.look`; el tema elegido es `look.theme`.
--
-- Sin tablas nuevas (no aplica RLS). Solo lectura, gateado por
-- _assert_internal_admin(). Excluye catálogos demo (tenants.is_demo).
-- "Último guardado" = tenant_ecommerce_config.updated_at (cambia con cualquier
-- edición de la configuración, no solo del diseño: es aproximado).

CREATE OR REPLACE FUNCTION public.catalog_editor_usage_admin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public._assert_internal_admin();

  WITH base AS (
    SELECT t.id AS tenant_id, t.name, t.slug,
           COALESCE(pl.name, t.plan_id::text, 'Gratis') AS plan_name,
           (COALESCE(pl.is_free, true) OR COALESCE(t.plan_expired, false)) AS is_free,
           c.design->'look' AS look,
           c.updated_at
    FROM public.tenants t
    LEFT JOIN public.plans pl ON pl.id = t.plan_id
    LEFT JOIN public.tenant_ecommerce_config c ON c.tenant_id = t.id
    WHERE NOT COALESCE(t.is_demo, false)
  ),
  used AS (
    SELECT * FROM base WHERE look IS NOT NULL AND jsonb_typeof(look) = 'object'
  ),
  dist AS (
    -- Opciones más elegidas (clave → valor → tiendas).
    SELECT k AS option, COALESCE(u.look->>k, '(sin dato)') AS value, count(*) AS stores
    FROM used u
    CROSS JOIN unnest(ARRAY['theme', 'font', 'bgType', 'buttonStyle', 'buttonShape', 'productLayout', 'categoryStyle', 'cardStyle']) AS k
    GROUP BY 1, 2
  )
  SELECT jsonb_build_object(
    'total_stores', (SELECT count(*) FROM base),
    'paid_stores', (SELECT count(*) FROM base WHERE NOT is_free),
    'using', (SELECT count(*) FROM used),
    'using_paid', (SELECT count(*) FROM used WHERE NOT is_free),
    'with_theme', (SELECT count(*) FROM used WHERE look->>'theme' IS NOT NULL),
    'last_7_days', (SELECT count(*) FROM used WHERE updated_at >= now() - interval '7 days'),
    'options', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('option', option, 'value', value, 'stores', stores) ORDER BY option, stores DESC)
      FROM dist
    ), '[]'::jsonb),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d.day::date, 'stores', COALESCE(x.n, 0)) ORDER BY d.day)
      FROM generate_series((now() AT TIME ZONE 'America/Caracas')::date - 29, (now() AT TIME ZONE 'America/Caracas')::date, interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT (updated_at AT TIME ZONE 'America/Caracas')::date AS day, count(*) AS n
        FROM used GROUP BY 1
      ) x ON x.day = d.day::date
    ), '[]'::jsonb),
    'stores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tenant_id', tenant_id, 'name', name, 'slug', slug, 'plan', plan_name, 'is_free', is_free,
        'theme', look->>'theme', 'font', look->>'font', 'bg_type', look->>'bgType',
        'button_style', look->>'buttonStyle', 'saved_at', updated_at
      ) ORDER BY updated_at DESC NULLS LAST)
      FROM used
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.catalog_editor_usage_admin() FROM anon;
