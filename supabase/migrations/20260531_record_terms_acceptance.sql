-- Persistir la aceptación explícita de Términos + Política de Privacidad al
-- crear cuenta. Audit-friendly: guardamos fecha + versión del documento que
-- estaba publicado al momento de aceptar (si cambiamos la política, podemos
-- forzar re-aceptación filtrando por versión).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_terms_version TEXT;

-- RPC que el frontend llama tras un signup exitoso. Usa el usuario
-- autenticado (auth.uid()) para resolver la fila correcta.
CREATE OR REPLACE FUNCTION public.record_terms_acceptance(
  p_version TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth
AS $function$
DECLARE
  v_auth_uid UUID;
  v_updated INTEGER;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.users
     SET accepted_terms_at      = now(),
         accepted_terms_version = COALESCE(NULLIF(p_version, ''), '1.0')
   WHERE auth_user_id = v_auth_uid;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END $function$;

REVOKE EXECUTE ON FUNCTION public.record_terms_acceptance(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_terms_acceptance(TEXT) TO authenticated;
