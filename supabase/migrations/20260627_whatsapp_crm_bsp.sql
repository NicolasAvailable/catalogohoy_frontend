-- =============================================================================
-- WhatsApp CRM multi-tenant (BSP) — columnas para conectar el número de cada
-- comerciante (Embedded Signup). Idempotente y defensiva: NO toca datos, NO toca
-- las notificaciones del +58 (que viven en secrets, no en esta tabla).
--
-- Cada comerciante guarda SU token (access_token) para enviar desde SU número.
-- El token NO se expone al front (el SELECT de WhatsAppService lista columnas
-- explícitas sin él); sólo las edge functions lo leen con service role.
-- Endurecer con Vault (pgsodium) en una 2ª pasada — ver CAT-41.
-- =============================================================================

ALTER TABLE public.whatsapp_accounts
  ADD COLUMN IF NOT EXISTS access_token     text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_name    text,
  ADD COLUMN IF NOT EXISTS quality_rating   text;

-- Un número (phone_number_id) pertenece a un solo registro activo. Las filas
-- demo tienen phone_number_id NULL → el índice parcial no las afecta.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_phone_number_id_uniq
  ON public.whatsapp_accounts (phone_number_id)
  WHERE phone_number_id IS NOT NULL;
