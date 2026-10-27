-- Acuses de entrega de Meta (statuses del webhook) para las notificaciones de
-- la plataforma. Antes `status = 'sent'` solo significaba "Meta aceptó el
-- envío"; ahora wa-webhook guarda sent → delivered → read / failed.
ALTER TABLE public.whatsapp_notification_logs
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS delivery_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS whatsapp_notification_logs_message_id_idx
  ON public.whatsapp_notification_logs (message_id)
  WHERE message_id IS NOT NULL;

-- Versión del listado del panel interno con el estado de entrega (nombre
-- nuevo para no tener que hacer DROP del RPC anterior, que cambia de firma).
CREATE OR REPLACE FUNCTION public.list_whatsapp_notification_logs_admin(
  p_limit integer DEFAULT 500,
  p_status text DEFAULT NULL::text,
  p_template_type text DEFAULT NULL::text,
  p_search text DEFAULT NULL::text
)
 RETURNS TABLE(id bigint, tenant_id bigint, tenant_name text, tenant_slug text, template_type text, recipient text, status text, message_id text, error text, variables jsonb, url_button_param text, created_at timestamp with time zone, delivery_status text, delivery_error text, delivery_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
    l.variables,
    l.url_button_param,
    l.created_at,
    l.delivery_status,
    l.delivery_error,
    l.delivery_updated_at
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
$function$;

REVOKE ALL ON FUNCTION public.list_whatsapp_notification_logs_admin(integer, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_whatsapp_notification_logs_admin(integer, text, text, text) TO authenticated;
