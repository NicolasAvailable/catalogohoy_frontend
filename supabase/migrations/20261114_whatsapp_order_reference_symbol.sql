-- Fix (2026-11-14, Motofox #9357): el aviso "Nuevo pedido" por WhatsApp
-- mostraba "Total: Bs.183.24 (Bs. 196,066.80)". El primer monto es total_usd
-- (moneda de REFERENCIA: $ / €), pero se le ponía tenant_currency_config.
-- currency_symbol, que es el símbolo de la moneda LOCAL (en Venezuela 'Bs.').
-- Afectaba a ~40% de los avisos (todos los catálogos VE dual-moneda).
--
-- Ahora el símbolo del total sale de display_currency (espejo de
-- TenantCurrencyStore.displaySymbol y de supabase/functions/_shared/currency.ts):
--   - centinela "sin símbolo" (U+200B) → sin símbolo
--   - catálogo dual o con referencia distinta a la moneda de productos →
--     USD '$', EUR '€', VES 'Bs. '
--   - resto → currency_symbol tal cual (RD$, Q, S/…)
CREATE OR REPLACE FUNCTION public.notify_order_whatsapp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         CASE
           WHEN cc.currency_symbol = U&'\200B' THEN ''
           WHEN (COALESCE(cc.show_dual_currency, false)
                 OR cc.display_currency IS DISTINCT FROM cc.product_currency)
                AND cc.display_currency IN ('USD', 'EUR', 'VES')
             THEN CASE cc.display_currency
                    WHEN 'USD' THEN '$'
                    WHEN 'EUR' THEN '€'
                    ELSE 'Bs. '
                  END
           ELSE COALESCE(NULLIF(TRIM(cc.currency_symbol), ''), '$')
         END,
         COALESCE(cc.show_dual_currency, false)
    INTO v_name, v_country, v_limit, v_symbol, v_dual
  FROM public.tenants t
  LEFT JOIN public.tenant_currency_config cc ON cc.tenant_id = t.id
  WHERE t.id = NEW.tenant_id;

  v_total := v_symbol || to_char(round(NEW.total_usd, 2), 'FM999G999G990D00');
  IF v_country = 'VE' AND v_dual AND COALESCE(NEW.total_bs, 0) > 0 THEN
    v_total := v_total || ' (Bs. ' || to_char(round(NEW.total_bs, 2), 'FM999G999G990D00') || ')';
  END IF;

  IF v_type = 'order_received' THEN
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
$function$;
