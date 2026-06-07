-- W1 — Foundation del módulo de Notificaciones WhatsApp (Meta Cloud API).
-- Brief: https://linear.app/catalogo-hoy/document/brief-notificaciones-whatsapp-74d716883654
-- Issues: CAT-13 (este), CAT-14 (edge function), CAT-16 (trigger).
--
-- Proveedor: Meta WhatsApp Cloud API directo. Las notificaciones proactivas
-- (fuera de la ventana de 24h) sólo pueden usar TEMPLATES pre-aprobados por
-- Meta. Por eso la config guarda el `meta_template_name` aprobado por tipo de
-- evento, no texto libre.

-- 1) Columnas en orders ----------------------------------------------------
--    whatsapp_opt_in  → consentimiento explícito del cliente final (checkout).
--    whatsapp_sent_at → idempotencia: el trigger no reenvía si ya está seteado.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ;

-- 2) Config de notificaciones WhatsApp por tenant + tipo de evento ----------
--    Una fila por (tenant, type). `enabled` es el toggle de Mi Perfil (W5).
--    `meta_template_name` + `language_code` resuelven el template aprobado.
CREATE TABLE IF NOT EXISTS public.whatsapp_notification_settings (
  tenant_id          BIGINT      NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type               TEXT        NOT NULL CHECK (type IN (
                       'order_received',   -- nueva orden  → tenant owner
                       'order_completed',  -- orden lista  → cliente final
                       'plan_expiring',    -- plan por vencer → owner
                       'payment_failed'    -- cobro fallido   → owner
                     )),
  enabled            BOOLEAN     NOT NULL DEFAULT true,
  meta_template_name TEXT        NOT NULL,
  language_code      TEXT        NOT NULL DEFAULT 'es',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, type)
);

COMMENT ON TABLE public.whatsapp_notification_settings IS
  'Config por tenant de notificaciones WhatsApp (Meta Cloud API). Una fila por tipo de evento.';

-- 3) RLS: cada miembro del tenant gestiona su propia config -----------------
ALTER TABLE public.whatsapp_notification_settings ENABLE ROW LEVEL SECURITY;

-- Membresía del usuario autenticado en el tenant (mismo mapeo que el resto
-- del sistema: auth.uid() → users.auth_user_id → users_tenants).
CREATE POLICY whatsapp_settings_member_all
  ON public.whatsapp_notification_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users_tenants ut
      JOIN public.users u ON u.id = ut.user_id
      WHERE ut.tenant_id = whatsapp_notification_settings.tenant_id
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users_tenants ut
      JOIN public.users u ON u.id = ut.user_id
      WHERE ut.tenant_id = whatsapp_notification_settings.tenant_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- La edge function (service_role) y el trigger leen/escriben sin pasar por RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_notification_settings TO service_role;

-- 4) Mantener updated_at -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_whatsapp_settings_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_settings_touch ON public.whatsapp_notification_settings;
CREATE TRIGGER trg_whatsapp_settings_touch
  BEFORE UPDATE ON public.whatsapp_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_whatsapp_settings_updated_at();
