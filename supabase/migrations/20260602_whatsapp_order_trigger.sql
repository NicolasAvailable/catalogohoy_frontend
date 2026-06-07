-- W3 (CAT-16) — Trigger en orders que dispara la notificación WhatsApp.
-- Brief: https://linear.app/catalogo-hoy/document/brief-notificaciones-whatsapp-74d716883654
--
-- Desacoplado vía pg_net: notifica venga la orden del catálogo público o del
-- admin. Mismo patrón que el cron `send-plan-expiry-warnings-daily`
-- (net.http_post + header x-webhook-secret, sin JWT de usuario).
--
-- Eventos:
--   * AFTER INSERT            → `order_received`  al dueño del catálogo.
--   * AFTER UPDATE→completed  → `order_completed` al cliente final (si opt-in).
--
-- Idempotencia: el INSERT dispara una sola vez; el UPDATE sólo en la transición
-- a 'completed' (guard OLD.status). No bloquea la transacción de la orden:
-- cualquier error se captura y se degrada a WARNING.
--
-- SECRETO: el `x-webhook-secret` se lee de Supabase Vault (nombre
-- `whatsapp_webhook_secret`), NO se hardcodea acá. Crearlo una vez en cada
-- entorno, fuera de esta migración:
--   select vault.create_secret('<secret>', 'whatsapp_webhook_secret');

CREATE OR REPLACE FUNCTION public.notify_order_whatsapp()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_url      TEXT := 'https://yvkurjivijnhliofmfmj.supabase.co/functions/v1/send-whatsapp-notification';
  v_secret   TEXT;
  v_type     TEXT;
  v_to       TEXT;
  v_name     TEXT;
  v_symbol   TEXT;
  v_dual     BOOLEAN;
  v_total    TEXT;
  v_products TEXT;
  v_vars     JSONB;
  v_button   TEXT;
BEGIN
  -- 1) Qué evento es
  IF (TG_OP = 'INSERT') THEN
    v_type := 'order_received';
  ELSIF (TG_OP = 'UPDATE'
         AND NEW.status = 'completed'
         AND OLD.status IS DISTINCT FROM 'completed') THEN
    v_type := 'order_completed';
  ELSE
    RETURN NEW;
  END IF;

  -- 2) Tenant + config de moneda (símbolo + si muestra Bs)
  SELECT t.name, COALESCE(cc.currency_symbol, '$'), COALESCE(cc.show_dual_currency, false)
    INTO v_name, v_symbol, v_dual
  FROM public.tenants t
  LEFT JOIN public.tenant_currency_config cc ON cc.tenant_id = t.id
  WHERE t.id = NEW.tenant_id;

  -- 3) Total — condicional: Bs sólo si el catálogo usa dual currency (VE)
  v_total := v_symbol || to_char(round(NEW.total_usd, 2), 'FM999G999G990D00');
  IF v_dual AND COALESCE(NEW.total_bs, 0) > 0 THEN
    v_total := v_total || ' (Bs. ' || to_char(round(NEW.total_bs, 2), 'FM999G999G990D00') || ')';
  END IF;

  IF v_type = 'order_received' THEN
    -- Destinatario: primer número de whatsapp_buttons del catálogo (el dueño)
    SELECT btn->>'number'
      INTO v_to
    FROM public.tenant_ecommerce_config ec,
         LATERAL jsonb_array_elements(COALESCE(ec.whatsapp_buttons, '[]'::jsonb)) AS btn
    WHERE ec.tenant_id = NEW.tenant_id
      AND COALESCE(btn->>'number', '') <> ''
    LIMIT 1;

    IF v_to IS NULL THEN
      RETURN NEW;  -- sin número configurado → no se puede notificar
    END IF;

    -- Resumen de productos en UNA línea (Meta rechaza saltos de línea en variables)
    SELECT string_agg((p->>'name') || ' x' || (p->>'quantity'), ', ')
      INTO v_products
    FROM (
      SELECT p
      FROM jsonb_array_elements(COALESCE(NEW.products, '[]'::jsonb)) WITH ORDINALITY AS e(p, ord)
      ORDER BY ord
      LIMIT 5
    ) s;

    IF jsonb_array_length(COALESCE(NEW.products, '[]'::jsonb)) > 5 THEN
      v_products := v_products || ' (+' ||
        (jsonb_array_length(NEW.products) - 5) || ' más)';
    END IF;
    v_products := COALESCE(NULLIF(v_products, ''), '—');

    v_vars := jsonb_build_array(
      regexp_replace(COALESCE(v_name, ''),   '\s+', ' ', 'g'),
      regexp_replace(COALESCE(NEW.name, ''), '\s+', ' ', 'g'),
      regexp_replace(COALESCE(NEW.phone, ''),'\s+', ' ', 'g'),
      regexp_replace(v_products,             '\s+', ' ', 'g'),
      v_total
    );
    v_button := NEW.id::TEXT;

  ELSE  -- order_completed → al cliente final
    IF NOT COALESCE(NEW.whatsapp_opt_in, false) OR COALESCE(NEW.phone, '') = '' THEN
      RETURN NEW;
    END IF;
    v_to   := NEW.phone;
    v_vars := jsonb_build_array(
      regexp_replace(COALESCE(NEW.name, ''), '\s+', ' ', 'g'),
      regexp_replace(COALESCE(v_name, ''),   '\s+', ' ', 'g')
    );
    v_button := NULL;
  END IF;

  -- 4) Secret desde Vault (no se hardcodea en el repo)
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'whatsapp_webhook_secret';

  IF v_secret IS NULL THEN
    RAISE WARNING 'notify_order_whatsapp: vault secret whatsapp_webhook_secret no encontrado';
    RETURN NEW;
  END IF;

  -- 5) Disparo asíncrono (no bloquea la transacción de la orden)
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object(
      'tenantId',       NEW.tenant_id,
      'to',             v_to,
      'templateType',   v_type,
      'variables',      v_vars,
      'urlButtonParam', v_button
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca romper la creación/actualización de la orden por una notificación.
  RAISE WARNING 'notify_order_whatsapp failed for order %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_whatsapp_notify ON public.orders;
CREATE TRIGGER trg_orders_whatsapp_notify
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_whatsapp();
