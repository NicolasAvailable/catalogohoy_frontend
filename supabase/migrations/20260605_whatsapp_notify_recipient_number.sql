-- W5b — Número destinatario configurable para `order_received`.
-- El tab Notificaciones del catálogo permite elegir a qué número (de los
-- whatsapp_buttons) se envía el aviso de nueva orden. Se guarda acá.
ALTER TABLE public.whatsapp_notification_settings
  ADD COLUMN IF NOT EXISTS recipient_number TEXT;

-- Trigger: usar el recipient_number configurado; si no hay, caer al primer
-- whatsapp_button del catálogo (comportamiento anterior).
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
  IF (TG_OP = 'INSERT') THEN
    v_type := 'order_received';
  ELSIF (TG_OP = 'UPDATE'
         AND NEW.status = 'completed'
         AND OLD.status IS DISTINCT FROM 'completed') THEN
    v_type := 'order_completed';
  ELSE
    RETURN NEW;
  END IF;

  SELECT t.name, COALESCE(cc.currency_symbol, '$'), COALESCE(cc.show_dual_currency, false)
    INTO v_name, v_symbol, v_dual
  FROM public.tenants t
  LEFT JOIN public.tenant_currency_config cc ON cc.tenant_id = t.id
  WHERE t.id = NEW.tenant_id;

  v_total := v_symbol || to_char(round(NEW.total_usd, 2), 'FM999G999G990D00');
  IF v_dual AND COALESCE(NEW.total_bs, 0) > 0 THEN
    v_total := v_total || ' (Bs. ' || to_char(round(NEW.total_bs, 2), 'FM999G999G990D00') || ')';
  END IF;

  IF v_type = 'order_received' THEN
    -- Número configurado en la tabla de settings; fallback al primer botón.
    SELECT NULLIF(recipient_number, '')
      INTO v_to
    FROM public.whatsapp_notification_settings
    WHERE tenant_id = NEW.tenant_id AND type = 'order_received';

    IF v_to IS NULL THEN
      SELECT btn->>'number'
        INTO v_to
      FROM public.tenant_ecommerce_config ec,
           LATERAL jsonb_array_elements(COALESCE(ec.whatsapp_buttons, '[]'::jsonb)) AS btn
      WHERE ec.tenant_id = NEW.tenant_id
        AND COALESCE(btn->>'number', '') <> ''
      LIMIT 1;
    END IF;

    IF v_to IS NULL THEN
      RETURN NEW;  -- sin número configurado → no se puede notificar
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

  -- Secret desde Vault (no se hardcodea en el repo)
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'whatsapp_webhook_secret';

  IF v_secret IS NULL THEN
    RAISE WARNING 'notify_order_whatsapp: vault secret whatsapp_webhook_secret no encontrado';
    RETURN NEW;
  END IF;

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
  RAISE WARNING 'notify_order_whatsapp failed for order %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
