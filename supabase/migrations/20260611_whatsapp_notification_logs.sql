-- W4 — Log de notificaciones WhatsApp (panel interno).
-- Brief: https://linear.app/catalogo-hoy/document/brief-notificaciones-whatsapp-74d716883654
--
-- La edge function `send-whatsapp-notification` es el ÚNICO chokepoint de
-- envío (la invocan el trigger de orders CAT-16, el cron de expiración y los
-- tests), así que cada intento inserta acá una fila: enviada / fallida /
-- omitida. Esto da un historial tipo "Resend" para el panel interno.
--
-- Escritura: sólo el service_role, desde la edge function (RLS sin políticas
-- → anon/authenticated no acceden; service_role la bypassa).
-- Lectura: panel interno vía RPC SECURITY DEFINER `list_whatsapp_logs_admin`,
-- restringida por whitelist de email (mismo criterio que ALLOWED_ADMIN_EMAILS
-- en apps/internal). NOTA: sólo registra envíos POSTERIORES al deploy de la
-- edge function actualizada — no hay backfill del historial previo.

CREATE TABLE IF NOT EXISTS public.whatsapp_notification_logs (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id        BIGINT REFERENCES public.tenants(id) ON DELETE SET NULL,
  template_type    TEXT NOT NULL,
  recipient        TEXT,
  status           TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  message_id       TEXT,
  error            TEXT,
  variables        JSONB,
  url_button_param TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_logs_created_at_idx
  ON public.whatsapp_notification_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_logs_tenant_idx
  ON public.whatsapp_notification_logs (tenant_id);
CREATE INDEX IF NOT EXISTS whatsapp_logs_status_idx
  ON public.whatsapp_notification_logs (status);

ALTER TABLE public.whatsapp_notification_logs ENABLE ROW LEVEL SECURITY;
-- Sin políticas a propósito: el service_role (edge function) bypassa RLS para
-- escribir, y el panel lee vía el RPC SECURITY DEFINER de abajo.

-- ---------------------------------------------------------------------------
-- RPC de lectura para el panel interno. SECURITY DEFINER + whitelist de email
-- (mismo patrón que el resto de los *_admin que ya viven en prod).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_whatsapp_logs_admin(
  p_limit         INT  DEFAULT 500,
  p_status        TEXT DEFAULT NULL,
  p_template_type TEXT DEFAULT NULL,
  p_search        TEXT DEFAULT NULL
)
  RETURNS TABLE (
    id               BIGINT,
    tenant_id        BIGINT,
    tenant_name      TEXT,
    tenant_slug      TEXT,
    template_type    TEXT,
    recipient        TEXT,
    status           TEXT,
    message_id       TEXT,
    error            TEXT,
    url_button_param TEXT,
    created_at       TIMESTAMPTZ
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Autorización server-side: misma whitelist que el panel interno.
  -- coalesce a '' para que un caller sin claim de email (anon / service) sea
  -- denegado en vez de pasar el filtro por culpa de un NULL.
  IF coalesce(auth.jwt() ->> 'email', '') NOT IN ('nicaso3006@gmail.com') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    l.template_type,
    l.recipient,
    l.status,
    l.message_id,
    l.error,
    l.url_button_param,
    l.created_at
  FROM public.whatsapp_notification_logs l
  LEFT JOIN public.tenants t ON t.id = l.tenant_id
  WHERE (p_status IS NULL        OR l.status = p_status)
    AND (p_template_type IS NULL OR l.template_type = p_template_type)
    AND (
      p_search IS NULL
      OR l.recipient ILIKE '%' || p_search || '%'
      OR t.name      ILIKE '%' || p_search || '%'
      OR t.slug      ILIKE '%' || p_search || '%'
    )
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 2000));
END;
$$;
