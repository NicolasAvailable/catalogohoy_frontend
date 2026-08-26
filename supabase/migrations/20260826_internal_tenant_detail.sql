-- Internal admin: detalle completo de un catálogo (tenant) en un solo RPC.
--
-- Motivo: el panel interno solo listaba catálogos; para soporte/ventas hace
-- falta abrir uno y ver TODO de un vistazo: órdenes (totales, últimos 30 días
-- y por mes), checklist de configuración inicial, historial de pagos y
-- renovaciones, equipo, canales conectados y actividad reciente. Un solo
-- round-trip (jsonb) para no encadenar ~8 queries desde el front.
--
-- NOTA renovaciones: los pagos manuales (Venezuela / asignados desde el
-- internal) viven en tenant_subscriptions; las renovaciones de Stripe NO se
-- registran ahí (stripe-webhook solo actualiza tenants.plan_*), así que
-- "renovaciones" = pagos registrados - 1. Para suscriptores Stripe el front
-- muestra además stripe_subscription_status.
--
-- Checklist de configuración inicial: mismos criterios que el card
-- "primeros pasos" del Inicio (getting-started.ts): primer producto,
-- personalización (logo/banner/descripción), vendedores WhatsApp del
-- checkout y avisos de órdenes por WhatsApp (solo planes pagos).

CREATE OR REPLACE FUNCTION public.get_tenant_detail_admin(p_tenant_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v jsonb;
BEGIN
  PERFORM public._assert_internal_admin();

  SELECT jsonb_build_object(
    'tenant', (
      SELECT to_jsonb(x) FROM (
        SELECT t.id, t.name, t.slug, t.country_code, t.created_at,
               t.custom_domain,
               COALESCE(t.extra_catalogs, 0) AS extra_catalogs,
               tec.logo, tec.banner, tec.description,
               COALESCE(tec.is_visible, true)          AS is_visible,
               COALESCE(tec.is_accepting_orders, true) AS is_accepting_orders,
               COALESCE(tcc.display_currency, tec.currency, 'USD') AS currency
        FROM tenants t
        LEFT JOIN tenant_ecommerce_config tec ON tec.tenant_id = t.id
        LEFT JOIN tenant_currency_config tcc ON tcc.tenant_id = t.id
        WHERE t.id = p_tenant_id
      ) x
    ),
    'plan', (
      SELECT to_jsonb(x) FROM (
        SELECT t.plan_id AS tier,
               t.plan_started_at AS started_at,
               t.plan_expires_at AS expires_at,
               COALESCE(t.plan_expired, false) AS expired,
               t.previous_plan_id,
               t.stripe_subscription_status,
               t.stripe_customer_id,
               (
                 SELECT ts.cycle FROM tenant_subscriptions ts
                 WHERE ts.tenant_id = t.id AND ts.status = 'active'
                 ORDER BY ts.started_at DESC LIMIT 1
               ) AS cycle
        FROM tenants t WHERE t.id = p_tenant_id
      ) x
    ),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', NULLIF(TRIM(CONCAT_WS(' ', u.name, u.last_name)), ''),
        'email', u.email,
        'phone', u.phone,
        'role', ut.role,
        'is_default', COALESCE(ut.is_default, false),
        'joined_at', ut.created_at,
        'avatar_url', COALESCE(au.raw_user_meta_data->>'avatar_url',
                               au.raw_user_meta_data->>'picture')
      ) ORDER BY (ut.role = 'owner') DESC, ut.created_at ASC)
      FROM users_tenants ut
      JOIN users u ON u.id = ut.user_id
      LEFT JOIN auth.users au ON au.id = u.auth_user_id
      WHERE ut.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'subscriptions', (
      SELECT jsonb_build_object(
        'payments_count', COUNT(*) FILTER (WHERE ts.status <> 'cancelled'),
        'renewals', GREATEST(
          COUNT(*) FILTER (WHERE ts.status <> 'cancelled') - 1, 0),
        'total_paid_usd',
          COALESCE(SUM(ts.amount_usd) FILTER (WHERE ts.status <> 'cancelled'), 0),
        'history', COALESCE(jsonb_agg(jsonb_build_object(
          'id', ts.id, 'tier', ts.tier, 'cycle', ts.cycle,
          'amount_usd', ts.amount_usd, 'payment_method', ts.payment_method,
          'status', ts.status, 'started_at', ts.started_at,
          'expires_at', ts.expires_at
        ) ORDER BY ts.started_at DESC), '[]'::jsonb)
      )
      FROM tenant_subscriptions ts WHERE ts.tenant_id = p_tenant_id
    ),
    'orders', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE o.status = 'completed'),
        'pending', COUNT(*) FILTER (WHERE o.status = 'pending'),
        'last_30d', COUNT(*) FILTER (
          WHERE o.created_at >= now() - interval '30 days'),
        'prev_30d', COUNT(*) FILTER (
          WHERE o.created_at >= now() - interval '60 days'
            AND o.created_at <  now() - interval '30 days'),
        'first_at', MIN(o.created_at),
        'last_at', MAX(o.created_at),
        'revenue_total', COALESCE(SUM(o.total_usd), 0),
        'revenue_completed',
          COALESCE(SUM(o.total_usd) FILTER (WHERE o.status = 'completed'), 0)
      )
      FROM orders o WHERE o.tenant_id = p_tenant_id
    ),
    'orders_monthly', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'month', to_char(m.month, 'YYYY-MM'),
        'count', COALESCE(agg.cnt, 0),
        'revenue', COALESCE(agg.rev, 0)
      ) ORDER BY m.month), '[]'::jsonb)
      FROM (
        SELECT (date_trunc('month', now()) - make_interval(months => i)) AS month
        FROM generate_series(11, 0, -1) AS i
      ) m
      LEFT JOIN (
        SELECT date_trunc('month', o.created_at) AS mo,
               COUNT(*) AS cnt, SUM(o.total_usd) AS rev
        FROM orders o
        WHERE o.tenant_id = p_tenant_id
          AND o.created_at >= date_trunc('month', now()) - interval '11 months'
        GROUP BY 1
      ) agg ON agg.mo = m.month
    ),
    'checklist', (
      SELECT jsonb_build_object(
        'has_product',
          (SELECT COUNT(*) FROM products p WHERE p.tenant_id = p_tenant_id) > 0,
        'customized',
          COALESCE(tec.logo, '') <> '' OR COALESCE(tec.banner, '') <> ''
          OR TRIM(COALESCE(tec.description, '')) <> '',
        'has_sellers',
          jsonb_array_length(COALESCE(tec.whatsapp_buttons, '[]'::jsonb)) > 0,
        'notify_configured', EXISTS (
          SELECT 1 FROM whatsapp_notification_settings wns
          WHERE wns.tenant_id = p_tenant_id
            AND COALESCE(wns.recipient_number, '') <> ''
        )
      )
      FROM tenants t
      LEFT JOIN tenant_ecommerce_config tec ON tec.tenant_id = t.id
      WHERE t.id = p_tenant_id
    ),
    'counts', jsonb_build_object(
      'products', (SELECT COUNT(*) FROM products p
                   WHERE p.tenant_id = p_tenant_id),
      'products_visible', (SELECT COUNT(*) FROM products p
                           WHERE p.tenant_id = p_tenant_id
                             AND COALESCE(p.is_hidden, false) = false),
      'categories', (SELECT COUNT(*) FROM categories c
                     WHERE c.tenant_id = p_tenant_id),
      'customers', (SELECT COUNT(*) FROM customers c
                    WHERE c.tenant_id = p_tenant_id),
      'chats', (SELECT COUNT(*) FROM chats c WHERE c.tenant_id = p_tenant_id),
      'team_members', (SELECT COUNT(*) FROM users_tenants ut
                       WHERE ut.tenant_id = p_tenant_id)
    ),
    'chats_by_channel', (
      SELECT COALESCE(jsonb_object_agg(s.channel, s.cnt), '{}'::jsonb)
      FROM (
        SELECT COALESCE(c.channel, 'whatsapp') AS channel, COUNT(*) AS cnt
        FROM chats c WHERE c.tenant_id = p_tenant_id
        GROUP BY 1
      ) s
    ),
    'channels', COALESCE((
      SELECT jsonb_agg(to_jsonb(ch) ORDER BY ch.connected_at DESC)
      FROM (
        SELECT 'whatsapp'::text AS channel, w.phone_number AS identity,
               w.display_name, w.created_at AS connected_at
        FROM whatsapp_accounts w
        WHERE w.tenant_id = p_tenant_id AND w.status = 'active'
        UNION ALL
        SELECT s.channel, s.username, s.display_name, s.created_at
        FROM social_accounts s
        WHERE s.tenant_id = p_tenant_id AND s.status = 'active'
      ) ch
    ), '[]'::jsonb),
    'activity', jsonb_build_object(
      'last_product_at', (SELECT MAX(p.created_at) FROM products p
                          WHERE p.tenant_id = p_tenant_id),
      'last_chat_at', (SELECT MAX(c.last_message_at) FROM chats c
                       WHERE c.tenant_id = p_tenant_id)
    )
  ) INTO v;

  RETURN v;
END;
$fn$;
