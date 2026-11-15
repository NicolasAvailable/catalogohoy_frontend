-- Venta de dominios dentro de CatalogoHoy (Namecheap).
--
-- Cada fila = un dominio comprado (o en compra) por una tienda. El dominio se
-- registra en Namecheap a nombre de CATALOGOHOY, LLC y se cobra al cliente con
-- una suscripción anual de Stripe. El avance lo maneja la edge function
-- `domains` (máquina de estados) y el `stripe-webhook`:
--
--   pending_payment → paid → registering → registered → connecting → active
--                          ↘ refunded (si falla la compra, se devuelve el pago)
--   active → canceled (no renueva; sigue activo hasta expires_at) → expired
--
-- Solo el service_role escribe. Los miembros de la tienda solo leen sus filas.
-- No toca `tenants.custom_domain` de las tiendas que ya tienen dominio propio
-- conectado a mano: solo se escribe al activar un dominio comprado aquí.

CREATE TABLE public.tenant_domains (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               bigint NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain                  text NOT NULL CHECK (domain = lower(domain) AND domain ~ '^[a-z0-9-]+(\.[a-z]{2,24}){1,2}$'),
  provider                text NOT NULL DEFAULT 'namecheap',
  status                  text NOT NULL DEFAULT 'pending_payment'
                          CHECK (status IN ('pending_payment', 'paid', 'registering', 'registered',
                                            'connecting', 'active', 'canceled', 'expired',
                                            'refunded', 'failed', 'abandoned')),
  years                   integer NOT NULL DEFAULT 1 CHECK (years BETWEEN 1 AND 10),
  -- Costos de Namecheap (centavos USD, con cargo ICANN) al momento de cotizar.
  register_cost_cents     integer NOT NULL CHECK (register_cost_cents >= 0),
  renew_cost_cents        integer NOT NULL CHECK (renew_cost_cents >= 0),
  -- Precio anual cobrado al cliente (centavos USD).
  price_cents             integer NOT NULL CHECK (price_cents > 0),
  currency                text NOT NULL DEFAULT 'usd',
  stripe_session_id       text UNIQUE,
  stripe_subscription_id  text UNIQUE,
  provider_order_id       text,
  provider_domain_id      text,
  auto_renew              boolean NOT NULL DEFAULT true,
  attempts                integer NOT NULL DEFAULT 0,
  last_error              text,
  requested_by            uuid DEFAULT auth.uid(),
  paid_at                 timestamptz,
  registered_at           timestamptz,
  activated_at            timestamptz,
  expires_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Un mismo dominio no puede estar "vivo" dos veces (evita doble compra).
CREATE UNIQUE INDEX tenant_domains_domain_live_uidx
  ON public.tenant_domains (domain)
  WHERE status NOT IN ('refunded', 'failed', 'abandoned', 'expired');

CREATE INDEX tenant_domains_tenant_idx ON public.tenant_domains (tenant_id, created_at DESC);
CREATE INDEX tenant_domains_pending_idx ON public.tenant_domains (status)
  WHERE status IN ('paid', 'registering', 'registered', 'connecting', 'canceled');

CREATE OR REPLACE FUNCTION public.touch_tenant_domains_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_tenant_domains_updated_at
  BEFORE UPDATE ON public.tenant_domains
  FOR EACH ROW EXECUTE FUNCTION public.touch_tenant_domains_updated_at();

-- RLS en la misma migración (regla: toda tabla pública nueva nace con RLS).
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_domains_select_members ON public.tenant_domains
  FOR SELECT TO authenticated
  USING (public._pos_can_access_tenant(tenant_id));

-- Sin políticas de INSERT/UPDATE/DELETE: solo el service_role (edge functions).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tenant_domains FROM anon, authenticated;
REVOKE ALL ON public.tenant_domains FROM anon;

-- Avance automático cada 5 minutos (compra → DNS → Vercel → activo, y vencidos).
-- El secreto vive en Vault (nombre `domains_cron_secret`), no en este archivo.
-- Crear antes de aplicar:
--   select vault.create_secret('<secreto>', 'domains_cron_secret');
-- y el mismo valor como secreto DOMAINS_CRON_SECRET de la edge function.
select cron.schedule(
  'domains-provision-5min',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://yvkurjivijnhliofmfmj.supabase.co/functions/v1/domains',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'domains_cron_secret' limit 1)
    ),
    body := '{"action":"provision"}'::jsonb
  )
  where exists (
    select 1 from public.tenant_domains
    where status in ('paid', 'registering', 'registered', 'connecting')
       or (status = 'canceled' and expires_at < now())
  );
  $cron$
);
