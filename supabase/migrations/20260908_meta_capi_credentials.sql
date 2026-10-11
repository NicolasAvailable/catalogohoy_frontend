-- Conversions API (CAPI) de Meta por tenant: credenciales SECRETAS.
--
-- El access_token da permiso para enviar eventos server-side al pixel del
-- comerciante, así que NO se expone al catálogo público (a diferencia del
-- meta_pixel_id, que sí es público). Vive en su propia tabla con RLS por tenant;
-- solo la edge function `meta-capi` lo lee con service role. Mismo criterio que
-- whatsapp_accounts.access_token.

CREATE TABLE IF NOT EXISTS public.meta_capi_credentials (
  tenant_id       BIGINT      PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  access_token    TEXT        NOT NULL,
  -- Código de evento de prueba de Events Manager (opcional): cuando está
  -- seteado, los eventos van solo a la consola "Probar eventos", sin contar
  -- para los anuncios. Útil para validar sin ensuciar la data real.
  test_event_code TEXT,
  enabled         BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.meta_capi_credentials IS
  'Token secreto de la Conversions API de Meta por tenant. Solo lo lee la edge '
  'function meta-capi (service role); nunca se expone al catálogo público.';

ALTER TABLE public.meta_capi_credentials ENABLE ROW LEVEL SECURITY;

-- Cada miembro del tenant gestiona su propia credencial (mismo mapeo que el
-- resto: auth.uid() → users.auth_user_id → users_tenants). El owner puede leer
-- SU token (es suyo); la RLS solo evita el acceso cross-tenant. El front igual
-- selecciona columnas explícitas sin el token para no traerlo al navegador.
CREATE POLICY meta_capi_member_all
  ON public.meta_capi_credentials
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users_tenants ut
      JOIN public.users u ON u.id = ut.user_id
      WHERE ut.tenant_id = meta_capi_credentials.tenant_id
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users_tenants ut
      JOIN public.users u ON u.id = ut.user_id
      WHERE ut.tenant_id = meta_capi_credentials.tenant_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- La edge function meta-capi (service_role) lee el token sin pasar por RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_capi_credentials TO service_role;
