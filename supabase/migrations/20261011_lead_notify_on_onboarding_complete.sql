-- Notificación de Slack cuando el usuario COMPLETA el onboarding: el wizard
-- renombra el slug temporal (mi-tienda-XXXX / tienda-XXXX) por el real, y ese
-- cambio dispara el aviso con el nombre+slug reales (event='onboarding_completed').
-- El aviso de 'signup' lo siguen disparando notify_new_lead / notify_lead_on_email_confirm
-- (la edge fn new-lead-slack v22 omite el slug temporal en ese caso).
-- Aplicada a prod vía MCP el 2026-10-11.

CREATE OR REPLACE FUNCTION public.notify_lead_on_onboarding_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_id bigint;
BEGIN
  SELECT ut.user_id INTO v_user_id
  FROM public.users_tenants ut
  WHERE ut.tenant_id = NEW.id AND ut.role = 'owner' AND ut.is_default = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://yvkurjivijnhliofmfmj.supabase.co/functions/v1/new-lead-slack',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'event', 'onboarding_completed',
      'type', 'UPDATE',
      'table', 'tenants',
      'record', jsonb_build_object('user_id', v_user_id, 'tenant_id', NEW.id)
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_onboarding_complete_notify_lead ON public.tenants;
CREATE TRIGGER on_onboarding_complete_notify_lead
AFTER UPDATE OF slug ON public.tenants
FOR EACH ROW
WHEN (
  OLD.slug IS DISTINCT FROM NEW.slug
  AND OLD.slug ~ '^(mi-)?tienda-[a-z0-9-]+$'
  AND NEW.slug !~ '^(mi-)?tienda-[a-z0-9-]+$'
)
EXECUTE FUNCTION public.notify_lead_on_onboarding_complete();
