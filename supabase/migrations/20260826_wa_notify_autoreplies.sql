-- Dedupe de la auto-respuesta del número de AVISOS: máx 1 cada 24h por
-- teléfono (la maneja wa-webhook con service role).
-- Aplicada en prod vía MCP el 2026-08-26 (junto con wa-webhook v31).
CREATE TABLE IF NOT EXISTS public.wa_notify_autoreplies (
  customer_phone text PRIMARY KEY,
  last_replied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_notify_autoreplies ENABLE ROW LEVEL SECURITY;
CREATE POLICY otto_ro_read ON public.wa_notify_autoreplies
  FOR SELECT TO otto_ro USING (true);
