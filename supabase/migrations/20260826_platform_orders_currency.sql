-- Órdenes del panel interno: los montos respetan la moneda de cada catálogo.
--
-- Bug: la card "Ingresos (compl.)" sumaba orders.total_usd de TODOS los
-- catálogos como si fueran dólares, pero esa columna guarda el monto en la
-- moneda del catálogo (COP, ARS, MXN, HNL...). El "$12,7M" real era 6,7M COP
-- + 5,3M ARS + ...; lo verdaderamente en USD eran ~$18,6k.
--
-- Fix:
--  1) platform_orders_stats_admin: `revenueUsd` pasa a sumar SOLO órdenes de
--     catálogos cuya moneda es USD, y se agrega `revenueByCurrency`
--     [{currency, orders, total}] (completadas, orden desc por total).
--  2) list_platform_orders_admin: devuelve `currency` por fila para que la
--     tabla muestre cada total en su moneda (DROP: cambia el return type).
--
-- Moneda del catálogo = COALESCE(tenant_currency_config.display_currency,
-- tenant_ecommerce_config.currency, 'USD') — mismo criterio que
-- get_tenant_detail_admin.

CREATE OR REPLACE FUNCTION public.platform_orders_stats_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM public._assert_internal_admin();

  RETURN jsonb_build_object(
    'total',     (SELECT count(*) FROM orders),
    'today',     (SELECT count(*) FROM orders WHERE created_at >= date_trunc('day', now())),
    'last7',     (SELECT count(*) FROM orders WHERE created_at >= now() - interval '7 days'),
    'last30',    (SELECT count(*) FROM orders WHERE created_at >= now() - interval '30 days'),
    'pending',   (SELECT count(*) FROM orders WHERE status = 'pending'),
    'completed', (SELECT count(*) FROM orders WHERE status = 'completed'),
    'cancelled', (SELECT count(*) FROM orders WHERE status = 'cancelled'),
    'revenueUsd', (
      SELECT COALESCE(sum(o.total_usd), 0)
      FROM orders o
      LEFT JOIN tenant_currency_config tcc ON tcc.tenant_id = o.tenant_id
      LEFT JOIN tenant_ecommerce_config tec ON tec.tenant_id = o.tenant_id
      WHERE o.status = 'completed'
        AND COALESCE(tcc.display_currency, tec.currency, 'USD') = 'USD'
    ),
    'revenueByCurrency', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'currency', x.currency, 'orders', x.orders, 'total', x.total
      ) ORDER BY x.total DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(tcc.display_currency, tec.currency, 'USD') AS currency,
               COUNT(*) AS orders, SUM(o.total_usd) AS total
        FROM orders o
        LEFT JOIN tenant_currency_config tcc ON tcc.tenant_id = o.tenant_id
        LEFT JOIN tenant_ecommerce_config tec ON tec.tenant_id = o.tenant_id
        WHERE o.status = 'completed'
        GROUP BY 1
      ) x
    ),
    'topTenants', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
      FROM (
        SELECT t.name AS name, t.slug AS slug, count(o.id) AS orders
        FROM orders o
        JOIN tenants t ON t.id = o.tenant_id
        GROUP BY t.id, t.name, t.slug
        ORDER BY count(o.id) DESC
        LIMIT 10
      ) x
    ),
    'daily', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) ORDER BY d), '[]'::jsonb)
      FROM (
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS d, count(*) AS cnt
        FROM orders
        WHERE created_at >= now() - interval '30 days'
        GROUP BY 1
      ) s
    )
  );
END
$fn$;

DROP FUNCTION IF EXISTS public.list_platform_orders_admin(integer);

CREATE FUNCTION public.list_platform_orders_admin(p_limit integer DEFAULT 200)
RETURNS TABLE(
  id bigint, order_number integer, tenant_name text, tenant_slug text,
  customer_name text, phone text, status text, total_usd numeric,
  total_bs numeric, currency text, item_count integer,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM public._assert_internal_admin();

  RETURN QUERY
  SELECT o.id, o.order_number, t.name, t.slug, o.name, o.phone, o.status,
         o.total_usd, o.total_bs,
         COALESCE(tcc.display_currency, tec.currency, 'USD'),
         COALESCE(jsonb_array_length(o.products), 0)::int,
         o.created_at
  FROM orders o
  JOIN tenants t ON t.id = o.tenant_id
  LEFT JOIN tenant_currency_config tcc ON tcc.tenant_id = o.tenant_id
  LEFT JOIN tenant_ecommerce_config tec ON tec.tenant_id = o.tenant_id
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
END
$fn$;
