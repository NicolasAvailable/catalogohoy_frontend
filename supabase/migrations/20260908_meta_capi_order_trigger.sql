-- Trigger de la Conversions API de Meta: en cada pedido PÚBLICO nuevo dispara
-- la edge function meta-capi con el evento Lead, usando el MISMO event_id que el
-- pixel del navegador (order-<id>) para que Meta deduplique. Separado del
-- trigger de notificaciones WhatsApp (notify_order_whatsapp) para no tocarlo.
--
-- Secret: usa el Vault (`meta_capi_webhook_secret`) para autenticar contra la
-- edge function (que valida `META_CAPI_WEBHOOK_SECRET`). Mismo patrón dual que
-- las notificaciones WhatsApp. Si no está el secret, es no-op.

CREATE OR REPLACE FUNCTION public.notify_order_meta_capi()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_url    TEXT := 'https://yvkurjivijnhliofmfmj.supabase.co/functions/v1/meta-capi';
  v_secret TEXT;
  v_slug   TEXT;
  v_items  INT;
BEGIN
  -- Solo pedidos PÚBLICOS (los del catálogo). Las órdenes manuales del admin no
  -- vienen de anuncios, así que no cuentan como conversión del pixel. Esto
  -- espeja exactamente el Lead que dispara el checkout público en el navegador.
  IF TG_OP <> 'INSERT' OR COALESCE(NEW.source, '') <> 'public' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'meta_capi_webhook_secret';

  IF v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT slug INTO v_slug FROM public.tenants WHERE id = NEW.tenant_id;
  v_items := COALESCE(jsonb_array_length(NEW.products), 0);

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object(
      'tenantId',  NEW.tenant_id,
      'eventName', 'Lead',
      'eventId',   'order-' || NEW.id,
      'value',     round(NEW.total_usd, 2),
      'currency',  'USD',
      'numItems',  v_items,
      'sourceUrl', CASE WHEN v_slug IS NOT NULL
                        THEN 'https://' || v_slug || '.catalogohoy.com'
                        ELSE NULL END,
      'phone',     NEW.phone,
      'email',     NEW.email
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Un fallo de notificación NUNCA debe bloquear el insert del pedido.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_meta_capi ON public.orders;
CREATE TRIGGER trg_orders_meta_capi
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_meta_capi();
