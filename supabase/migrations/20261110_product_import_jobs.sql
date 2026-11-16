-- Imports de productos en segundo plano (Excel / Google Sheets / PDF / fotos).
-- El import sigue corriendo en el navegador mientras el usuario usa la app;
-- esta tabla guarda el avance y el resultado (qué entró y qué falló) para:
--   * el aviso en Productos (también si el import se cortó al cerrar la app),
--   * el correo de resumen (edge `send-import-summary`, marca emailed_at).
-- Cada usuario ve solo sus propios imports, en tiendas donde puede crear
-- productos (dueño o miembro con productos:create).

CREATE TABLE public.product_import_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     bigint NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_user_id  uuid NOT NULL DEFAULT auth.uid(),
  source        text NOT NULL CHECK (source IN ('excel', 'sheets', 'pdf', 'fotos')),
  file_name     text CHECK (file_name IS NULL OR length(file_name) <= 200),
  status        text NOT NULL DEFAULT 'running'
                CHECK (status IN ('running', 'done', 'cancelled')),
  total         integer NOT NULL DEFAULT 0 CHECK (total >= 0),
  processed     integer NOT NULL DEFAULT 0 CHECK (processed >= 0),
  success       integer NOT NULL DEFAULT 0 CHECK (success >= 0),
  errors        integer NOT NULL DEFAULT 0 CHECK (errors >= 0),
  skipped       integer NOT NULL DEFAULT 0 CHECK (skipped >= 0),
  -- Filas/fotos que fallaron: [{ name, error }] (máx. 200).
  failed        jsonb NOT NULL DEFAULT '[]'::jsonb
                CHECK (jsonb_typeof(failed) = 'array' AND jsonb_array_length(failed) <= 200),
  -- true = terminó con el modal cerrado (se avisa en Productos y por correo).
  backgrounded  boolean NOT NULL DEFAULT false,
  emailed_at    timestamptz,
  dismissed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

CREATE INDEX product_import_jobs_user_idx
  ON public.product_import_jobs (tenant_id, auth_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_product_import_jobs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  NEW.tenant_id := OLD.tenant_id;
  NEW.auth_user_id := OLD.auth_user_id;
  -- El correo solo lo marca la edge function (service_role).
  IF NEW.emailed_at IS DISTINCT FROM OLD.emailed_at
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.emailed_at := OLD.emailed_at;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_product_import_jobs_updated_at
  BEFORE UPDATE ON public.product_import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_product_import_jobs_updated_at();

ALTER TABLE public.product_import_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.product_import_jobs FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.product_import_jobs TO authenticated;

CREATE POLICY product_import_jobs_select ON public.product_import_jobs
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
CREATE POLICY product_import_jobs_insert ON public.product_import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid()
    AND public._tenant_module_allowed(tenant_id, 'productos', 'create')
  );
CREATE POLICY product_import_jobs_update ON public.product_import_jobs
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
