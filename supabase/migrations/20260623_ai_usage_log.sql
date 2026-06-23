-- =============================================================================
-- Log de uso de IA por generación (feature + prompt + créditos por usuario).
-- Lo escriben los edge functions fal-ai-images / improve-text tras una
-- generación exitosa (vía service role). Lo lee el panel internal vía RPCs
-- admin (gate por email, como list_whatsapp_logs_admin).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint REFERENCES public.users(id) ON DELETE SET NULL,
  feature    text   NOT NULL,
  prompt     text,
  credits    int    NOT NULL DEFAULT 0,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_log_user_id_idx    ON public.ai_usage_log (user_id);
CREATE INDEX IF NOT EXISTS ai_usage_log_feature_idx    ON public.ai_usage_log (feature);
CREATE INDEX IF NOT EXISTS ai_usage_log_created_at_idx ON public.ai_usage_log (created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage_log FROM anon, authenticated;

-- ai_usage_stats_admin(): agregados para el dashboard (gate por email admin).
CREATE OR REPLACE FUNCTION public.ai_usage_stats_admin()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_result json;
BEGIN
  IF coalesce(auth.jwt() ->> 'email', '') NOT IN ('nicaso3006@gmail.com') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT json_build_object(
    'total_credits',     COALESCE((SELECT sum(credits) FROM ai_usage_log), 0),
    'total_generations', (SELECT count(*) FROM ai_usage_log),
    'users_count',       (SELECT count(DISTINCT user_id) FROM ai_usage_log),
    'by_feature', COALESCE((SELECT json_agg(f) FROM (
        SELECT feature, count(*)::int AS generations, sum(credits)::int AS credits
        FROM ai_usage_log GROUP BY feature ORDER BY sum(credits) DESC) f), '[]'::json),
    'top_users', COALESCE((SELECT json_agg(u) FROM (
        SELECT l.user_id, us.name AS user_name, us.email AS user_email,
               count(*)::int AS generations, sum(l.credits)::int AS credits
        FROM ai_usage_log l LEFT JOIN users us ON us.id = l.user_id
        GROUP BY l.user_id, us.name, us.email ORDER BY sum(l.credits) DESC LIMIT 20) u), '[]'::json),
    'last_30d', COALESCE((SELECT json_agg(d ORDER BY d.day) FROM (
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               sum(credits)::int AS credits, count(*)::int AS generations
        FROM ai_usage_log WHERE created_at >= now() - interval '30 days'
        GROUP BY date_trunc('day', created_at)) d), '[]'::json)
  ) INTO v_result;
  RETURN v_result;
END; $function$;

-- list_ai_usage_logs_admin(): log paginado con filtros.
CREATE OR REPLACE FUNCTION public.list_ai_usage_logs_admin(
  p_limit integer DEFAULT 200, p_feature text DEFAULT NULL, p_search text DEFAULT NULL
)
RETURNS TABLE (id bigint, user_id bigint, user_name text, user_email text,
               feature text, prompt text, credits int, metadata jsonb, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF coalesce(auth.jwt() ->> 'email', '') NOT IN ('nicaso3006@gmail.com') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT l.id, l.user_id, us.name, us.email, l.feature, l.prompt, l.credits, l.metadata, l.created_at
  FROM public.ai_usage_log l LEFT JOIN public.users us ON us.id = l.user_id
  WHERE (p_feature IS NULL OR l.feature = p_feature)
    AND (p_search IS NULL OR l.prompt ILIKE '%'||p_search||'%'
         OR us.name ILIKE '%'||p_search||'%' OR us.email ILIKE '%'||p_search||'%')
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 2000));
END; $function$;

REVOKE ALL ON FUNCTION public.ai_usage_stats_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_ai_usage_logs_admin(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_usage_stats_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_ai_usage_logs_admin(integer, text, text) TO authenticated;
