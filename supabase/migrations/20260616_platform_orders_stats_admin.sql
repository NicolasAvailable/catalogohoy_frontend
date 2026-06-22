-- Platform-wide order metrics for the internal admin ("Órdenes" section).
-- SECURITY DEFINER + _assert_internal_admin() gate, same pattern as
-- list_paying_clients_admin, so it bypasses per-tenant RLS but only for
-- authenticated internal admins.
CREATE OR REPLACE FUNCTION public.platform_orders_stats_admin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'revenueUsd',(SELECT COALESCE(sum(total_usd), 0) FROM orders WHERE status = 'completed'),
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
$function$;
