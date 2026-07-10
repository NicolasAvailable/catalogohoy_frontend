-- =============================================================================
-- WhatsApp Business + CRM — fundación de datos
--
-- Idempotente y defensiva: las tablas chats/chat_messages YA existen en prod
-- (creadas fuera del repo), whatsapp_accounts puede o no existir. Por eso todo
-- es CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS. Agrega las columnas
-- CRM, las tablas pipeline_statuses/quick_replies, RLS por tenant, realtime, y
-- los RPCs públicos del simulador de cliente (post + fetch).
--
-- RLS pattern del proyecto: users_tenants.user_id es bigint -> users.id, y el
-- uuid de auth está en users.auth_user_id (= auth.uid()).
-- =============================================================================

-- 0) Tablas base (no-op si ya existen) ----------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       bigint NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone_number    text   NOT NULL DEFAULT '',
  display_name    text,
  waba_id         text,
  phone_number_id text,
  status          text   NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chats (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       bigint NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id        bigint,
  customer_name   text,
  customer_phone  text,
  last_message    text,
  last_message_at timestamptz,
  unread_count    int    NOT NULL DEFAULT 0,
  muted           boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id    bigint NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  content    text   NOT NULL DEFAULT '',
  is_mine    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_chat_id_idx
  ON public.chat_messages (chat_id);
CREATE INDEX IF NOT EXISTS chats_tenant_id_idx
  ON public.chats (tenant_id);

-- 1) Columnas CRM en chats -----------------------------------------------------
ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS pipeline_status      text,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id  bigint REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_notes       jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tags                 text[] NOT NULL DEFAULT '{}'::text[];

-- 2) Pipeline statuses configurables por tenant -------------------------------
CREATE TABLE IF NOT EXISTS public.pipeline_statuses (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id  bigint NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key        text   NOT NULL,
  name       text   NOT NULL,
  color      text   NOT NULL DEFAULT '#6b7280',
  position   int    NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_statuses_tenant_key_uniq
  ON public.pipeline_statuses (tenant_id, key);

-- 3) Quick replies (plantillas de respuesta) ----------------------------------
CREATE TABLE IF NOT EXISTS public.quick_replies (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id  bigint NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shortcut   text   NOT NULL,
  content    text   NOT NULL,
  position   int    NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quick_replies_tenant_id_idx
  ON public.quick_replies (tenant_id);

-- 4) RLS por tenant ------------------------------------------------------------
-- Helper inline: el usuario autenticado es miembro del tenant.
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies     ENABLE ROW LEVEL SECURITY;

-- whatsapp_accounts
DROP POLICY IF EXISTS whatsapp_accounts_tenant_all ON public.whatsapp_accounts;
CREATE POLICY whatsapp_accounts_tenant_all ON public.whatsapp_accounts
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users_tenants ut
    JOIN public.users u ON u.id = ut.user_id
    WHERE ut.tenant_id = whatsapp_accounts.tenant_id AND u.auth_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users_tenants ut
    JOIN public.users u ON u.id = ut.user_id
    WHERE ut.tenant_id = whatsapp_accounts.tenant_id AND u.auth_user_id = auth.uid()
  ));

-- chats
DROP POLICY IF EXISTS chats_tenant_all ON public.chats;
CREATE POLICY chats_tenant_all ON public.chats
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users_tenants ut
    JOIN public.users u ON u.id = ut.user_id
    WHERE ut.tenant_id = chats.tenant_id AND u.auth_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users_tenants ut
    JOIN public.users u ON u.id = ut.user_id
    WHERE ut.tenant_id = chats.tenant_id AND u.auth_user_id = auth.uid()
  ));

-- chat_messages (vía join a chats; chat_messages no tiene tenant_id)
DROP POLICY IF EXISTS chat_messages_tenant_all ON public.chat_messages;
CREATE POLICY chat_messages_tenant_all ON public.chat_messages
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.chats c
    JOIN public.users_tenants ut ON ut.tenant_id = c.tenant_id
    JOIN public.users u ON u.id = ut.user_id
    WHERE c.id = chat_messages.chat_id AND u.auth_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chats c
    JOIN public.users_tenants ut ON ut.tenant_id = c.tenant_id
    JOIN public.users u ON u.id = ut.user_id
    WHERE c.id = chat_messages.chat_id AND u.auth_user_id = auth.uid()
  ));

-- pipeline_statuses
DROP POLICY IF EXISTS pipeline_statuses_tenant_all ON public.pipeline_statuses;
CREATE POLICY pipeline_statuses_tenant_all ON public.pipeline_statuses
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users_tenants ut
    JOIN public.users u ON u.id = ut.user_id
    WHERE ut.tenant_id = pipeline_statuses.tenant_id AND u.auth_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users_tenants ut
    JOIN public.users u ON u.id = ut.user_id
    WHERE ut.tenant_id = pipeline_statuses.tenant_id AND u.auth_user_id = auth.uid()
  ));

-- quick_replies
DROP POLICY IF EXISTS quick_replies_tenant_all ON public.quick_replies;
CREATE POLICY quick_replies_tenant_all ON public.quick_replies
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users_tenants ut
    JOIN public.users u ON u.id = ut.user_id
    WHERE ut.tenant_id = quick_replies.tenant_id AND u.auth_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users_tenants ut
    JOIN public.users u ON u.id = ut.user_id
    WHERE ut.tenant_id = quick_replies.tenant_id AND u.auth_user_id = auth.uid()
  ));

REVOKE ALL ON public.whatsapp_accounts, public.chats, public.chat_messages,
              public.pipeline_statuses, public.quick_replies FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.whatsapp_accounts, public.chats, public.chat_messages,
     public.pipeline_statuses, public.quick_replies
  TO authenticated;

-- 5) Realtime: publicar chats + chat_messages (si no están ya) -----------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

-- 6) RPCs públicos del simulador de cliente -----------------------------------
-- Permiten que un cliente ANÓNIMO escriba y lea SOLO su propia conversación,
-- sin exponer las tablas. Reemplazan el webhook entrante de Meta mientras se
-- aprueba la API. Cuando llegue la API real, el edge function wa-webhook hará
-- lo mismo con el service role.

CREATE OR REPLACE FUNCTION public.post_demo_customer_message(
  p_slug  text,
  p_phone text,
  p_name  text,
  p_text  text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id bigint;
  v_digits    text;
  v_chat_id   bigint;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = p_slug;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_not_found';
  END IF;

  v_digits := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  IF length(v_digits) < 7 OR length(coalesce(trim(p_text), '')) = 0 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  -- find-or-create la conversación por (tenant, teléfono normalizado)
  SELECT id INTO v_chat_id
  FROM public.chats
  WHERE tenant_id = v_tenant_id
    AND regexp_replace(COALESCE(customer_phone, ''), '\D', '', 'g') = v_digits
  ORDER BY id DESC
  LIMIT 1;

  IF v_chat_id IS NULL THEN
    INSERT INTO public.chats (tenant_id, customer_name, customer_phone, created_at)
    VALUES (v_tenant_id, NULLIF(trim(p_name), ''), p_phone, now())
    RETURNING id INTO v_chat_id;
  END IF;

  INSERT INTO public.chat_messages (chat_id, content, is_mine, created_at)
  VALUES (v_chat_id, p_text, false, now());

  UPDATE public.chats
     SET last_message     = p_text,
         last_message_at  = now(),
         unread_count     = unread_count + 1,
         customer_name    = COALESCE(NULLIF(customer_name, ''), NULLIF(trim(p_name), ''))
   WHERE id = v_chat_id;

  RETURN v_chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_demo_chat_messages(
  p_chat_id bigint,
  p_phone   text
)
RETURNS TABLE (id bigint, chat_id bigint, content text, is_mine boolean, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text;
  v_ok     boolean;
BEGIN
  v_digits := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

  -- Verifica que el teléfono coincide con el dueño del chat: evita que un anon
  -- enumere conversaciones por id.
  SELECT EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = p_chat_id
      AND regexp_replace(COALESCE(c.customer_phone, ''), '\D', '', 'g') = v_digits
  ) INTO v_ok;

  IF NOT v_ok THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.id, m.chat_id, m.content, m.is_mine, m.created_at
  FROM public.chat_messages m
  WHERE m.chat_id = p_chat_id
  ORDER BY m.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.post_demo_customer_message(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_demo_chat_messages(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_demo_customer_message(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_demo_chat_messages(bigint, text) TO anon, authenticated;
