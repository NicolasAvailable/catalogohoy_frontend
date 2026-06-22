-- Expone las variables enviadas (contenido del template) + url_button_param
-- en el panel de logs interno. La columna `variables` ya existía en la tabla
-- (creada en 20260611_whatsapp_notification_logs.sql); sólo faltaba devolverla
-- en el RPC. Como cambia el RETURNS TABLE, hay que DROP+CREATE (no se puede
-- CREATE OR REPLACE con distinta firma de salida). Atómico dentro de la migración.

DROP FUNCTION IF EXISTS public.list_whatsapp_logs_admin(int, text, text, text);

CREATE FUNCTION public.list_whatsapp_logs_admin(
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
    variables        JSONB,
    url_button_param TEXT,
    created_at       TIMESTAMPTZ
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Autorización server-side: misma whitelist que el panel interno.
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
