-- Segundo número destinatario para el aviso de nueva orden (order_received),
-- gateado por tenant. Por defecto todos los tenants siguen con 1 número;
-- `tenants.whatsapp_notify_numbers_limit` (patrón slug_change_limit) permite
-- habilitar hasta 2 a tenants puntuales sin tocar la regla general.
-- Aplicada en prod el 2026-07-13 vía MCP.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS whatsapp_notify_numbers_limit INTEGER;

ALTER TABLE public.whatsapp_notification_settings
  ADD COLUMN IF NOT EXISTS recipient_number_2 TEXT;

-- Trigger: order_received puede avisar a hasta 2 números. El segundo solo se
-- usa si el límite del tenant lo permite (coalesce 1) — defensa en profundidad
-- por si alguien escribe recipient_number_2 sin tener el cupo habilitado.
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
  v_tos      TEXT[];
  v_limit    INT;
  v_name     TEXT;
  v_country  TEXT;
  v_symbol   TEXT;
  v_dual     BOOLEAN;
  v_total    TEXT;
  v_products TEXT;
  v_vars     JSONB;
  v_button   TEXT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_type := 'order_received';
  ELSIF (TG_OP = 'UPDATE'
         AND NEW.status = 'completed'
         AND OLD.status IS DISTINCT FROM 'completed') THEN
    v_type := 'order_completed';
  ELSE
    RETURN NEW;
  END IF;

  SELECT t.name, t.country_code, COALESCE(t.whatsapp_notify_numbers_limit, 1),
         COALESCE(cc.currency_symbol, '$'), COALESCE(cc.show_dual_currency, false)
    INTO v_name, v_country, v_limit, v_symbol, v_dual
  FROM public.tenants t
  LEFT JOIN public.tenant_currency_config cc ON cc.tenant_id = t.id
  WHERE t.id = NEW.tenant_id;

  -- Total en la moneda del catálogo. El monto en Bs (dual) sólo para Venezuela.
  v_total := v_symbol || to_char(round(NEW.total_usd, 2), 'FM999G999G990D00');
  IF v_country = 'VE' AND v_dual AND COALESCE(NEW.total_bs, 0) > 0 THEN
    v_total := v_total || ' (Bs. ' || to_char(round(NEW.total_bs, 2), 'FM999G999G990D00') || ')';
  END IF;

  IF v_type = 'order_received' THEN
    -- Destinatarios configurados (1º + 2º si el tenant tiene cupo); el 2º se
    -- descarta si repite al 1º. Fallback al primer whatsapp_button si no hay
    -- número principal configurado (comportamiento histórico).
    SELECT array_remove(ARRAY[
             NULLIF(recipient_number, ''),
             CASE WHEN v_limit >= 2
                    AND NULLIF(recipient_number_2, '') IS DISTINCT FROM NULLIF(recipient_number, '')
                  THEN NULLIF(recipient_number_2, '')
             END
           ], NULL)
      INTO v_tos
    FROM public.whatsapp_notification_settings
    WHERE tenant_id = NEW.tenant_id AND type = 'order_received';

    IF COALESCE(array_length(v_tos, 1), 0) = 0 THEN
      SELECT ARRAY[btn->>'number']
        INTO v_tos
      FROM public.tenant_ecommerce_config ec,
           LATERAL jsonb_array_elements(COALESCE(ec.whatsapp_buttons, '[]'::jsonb)) AS btn
      WHERE ec.tenant_id = NEW.tenant_id
        AND COALESCE(btn->>'number', '') <> ''
      LIMIT 1;
    END IF;

    IF COALESCE(array_length(v_tos, 1), 0) = 0 THEN
      RETURN NEW;
    END IF;

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

  ELSE
    IF NOT COALESCE(NEW.whatsapp_opt_in, false) OR COALESCE(NEW.phone, '') = '' THEN
      RETURN NEW;
    END IF;
    v_tos  := ARRAY[NEW.phone];
    v_vars := jsonb_build_array(
      regexp_replace(COALESCE(NEW.name, ''), '\s+', ' ', 'g'),
      regexp_replace(COALESCE(v_name, ''),   '\s+', ' ', 'g')
    );
    v_button := NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'whatsapp_webhook_secret';

  IF v_secret IS NULL THEN
    RAISE WARNING 'notify_order_whatsapp: vault secret whatsapp_webhook_secret no encontrado';
    RETURN NEW;
  END IF;

  FOREACH v_to IN ARRAY v_tos LOOP
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
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_order_whatsapp failed for order %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Detalles CECY (tenant 149): habilitada para 2 números a pedido de soporte.
UPDATE public.tenants
   SET whatsapp_notify_numbers_limit = 2
 WHERE id = 149;
