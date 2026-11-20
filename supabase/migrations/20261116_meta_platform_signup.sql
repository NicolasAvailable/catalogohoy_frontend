-- Registro (CompleteRegistration) al píxel propio de CatalogoHoy desde el SERVIDOR,
-- cuando un dueño crea su PRIMER catálogo. Cubre los registros que no pasan por
-- la pantalla de signup web (Google desde la app nativa, versiones viejas de la
-- app, etc.). La edge fn platform-capi valida el secreto, descarta cuentas de más
-- de 24 h y manda el evento con eventId CompleteRegistration-<auth uuid> (el
-- mismo que el signup web → Meta cuenta uno solo).
-- Nunca rompe el alta: cualquier error se ignora.

CREATE OR REPLACE FUNCTION public.notify_meta_platform_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  IF NEW.role <> 'owner' THEN
    RETURN NEW;
  END IF;

  -- Solo el primer catálogo del dueño (un segundo catálogo no es un registro).
  IF EXISTS (
    SELECT 1 FROM public.users_tenants
    WHERE user_id = NEW.user_id AND role = 'owner' AND id <> NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'meta_capi_webhook_secret';

  IF v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := 'https://yvkurjivijnhliofmfmj.supabase.co/functions/v1/platform-capi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object('mode', 'signup', 'userId', NEW.user_id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_meta_platform_signup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_meta_platform_signup ON public.users_tenants;
CREATE TRIGGER trg_meta_platform_signup
  AFTER INSERT ON public.users_tenants
  FOR EACH ROW EXECUTE FUNCTION public.notify_meta_platform_signup();
