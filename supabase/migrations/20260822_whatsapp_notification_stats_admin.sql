-- Agregado mensual de notificaciones WhatsApp por plantilla para el panel
-- interno "Notificaciones WhatsApp". Mismo gating que list_whatsapp_logs_admin.
-- Solo cuenta envíos por la WABA del portfolio CatalogoHoy LLC (1038950559044032):
-- el número se re-registró ahí el 14-08-2026; lo anterior salió por el
-- portfolio viejo y no corresponde a la facturación actual de Meta.
CREATE OR REPLACE FUNCTION public.whatsapp_notification_stats_admin(
  p_months integer DEFAULT 6
)
RETURNS TABLE(
  month text,
  template_type text,
  sent bigint,
  failed bigint,
  skipped bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'email', '') NOT IN ('nicaso3006@gmail.com') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    to_char(date_trunc('month', l.created_at), 'YYYY-MM') AS month,
    l.template_type,
    count(*) FILTER (WHERE l.status = 'sent')    AS sent,
    count(*) FILTER (WHERE l.status = 'failed')  AS failed,
    count(*) FILTER (WHERE l.status = 'skipped') AS skipped
  FROM public.whatsapp_notification_logs l
  WHERE l.created_at >= '2026-08-14T00:00:00Z'::timestamptz
    AND l.created_at >= date_trunc('month', now())
    - make_interval(months => GREATEST(1, LEAST(p_months, 24)) - 1)
  GROUP BY 1, 2
  ORDER BY 1 DESC, 2;
END;
$$;
