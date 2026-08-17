-- Notificaciones de billing por WhatsApp (payment_failed + plan_expiring).
-- Aplicada a prod vía MCP el 2026-07-22. Ver función resolve_billing_wa_recipient
-- (cascada de destinatario) y trigger trg_seed_wa_billing (tenants nuevos).
ALTER TABLE tenant_expiry_warnings
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamptz;

INSERT INTO whatsapp_notification_settings (tenant_id, type, enabled, meta_template_name, language_code)
SELECT t.id, v.type, true, v.tpl, 'es'
FROM tenants t
CROSS JOIN (VALUES
  ('payment_failed', 'payment_failed'),
  ('plan_expiring', 'plan_expiry_warning')
) AS v(type, tpl)
ON CONFLICT (tenant_id, type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_whatsapp_billing_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.whatsapp_notification_settings (tenant_id, type, enabled, meta_template_name, language_code)
  VALUES
    (NEW.id, 'payment_failed', true, 'payment_failed', 'es'),
    (NEW.id, 'plan_expiring', true, 'plan_expiry_warning', 'es')
  ON CONFLICT (tenant_id, type) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_wa_billing ON public.tenants;
CREATE TRIGGER trg_seed_wa_billing
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.seed_whatsapp_billing_settings();

CREATE OR REPLACE FUNCTION public.resolve_billing_wa_recipient(p_tenant_id bigint, p_type text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(TRIM(recipient_number), '')
       FROM public.whatsapp_notification_settings
      WHERE tenant_id = p_tenant_id AND type = p_type),
    (SELECT NULLIF(TRIM(recipient_number), '')
       FROM public.whatsapp_notification_settings
      WHERE tenant_id = p_tenant_id AND type = 'order_received'),
    (SELECT NULLIF(TRIM(b->>'number'), '')
       FROM public.tenant_ecommerce_config c,
            jsonb_array_elements(c.whatsapp_buttons) AS b
      WHERE c.tenant_id = p_tenant_id AND NULLIF(TRIM(b->>'number'), '') IS NOT NULL
      LIMIT 1)
  );
$$;

REVOKE ALL ON FUNCTION public.resolve_billing_wa_recipient(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_billing_wa_recipient(bigint, text) TO service_role;
