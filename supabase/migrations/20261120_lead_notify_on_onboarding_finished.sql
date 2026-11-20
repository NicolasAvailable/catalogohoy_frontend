-- Aviso de Slack "Onboarding completado" al TERMINAR el wizard (último paso,
-- "¿Cómo nos conociste?"), no al renombrar el slug en el paso 3. Así el aviso
-- ya trae "Dónde nos conoció" (user_metadata.heard_from, que el frontend guarda
-- justo antes de cerrar el onboarding).
-- El wizard cierra poniendo tenants.onboarding_step = NULL (desde un número).
-- Solo avisa si la tienda ya tiene slug real (no mi-tienda-XXXX / tienda-XXXX).
-- Reemplaza al trigger on_onboarding_complete_notify_lead (20261011), que
-- disparaba con el rename del slug. La función notify_lead_on_onboarding_complete
-- se reutiliza tal cual.

DROP TRIGGER IF EXISTS on_onboarding_complete_notify_lead ON public.tenants;

DROP TRIGGER IF EXISTS on_onboarding_finished_notify_lead ON public.tenants;
CREATE TRIGGER on_onboarding_finished_notify_lead
AFTER UPDATE OF onboarding_step ON public.tenants
FOR EACH ROW
WHEN (
  OLD.onboarding_step IS NOT NULL
  AND NEW.onboarding_step IS NULL
  AND NEW.slug !~ '^(mi-)?tienda-[a-z0-9-]+$'
)
EXECUTE FUNCTION public.notify_lead_on_onboarding_complete();
