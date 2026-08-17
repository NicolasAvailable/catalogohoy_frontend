-- =============================================================================
-- Fix: fuga cross-tenant en chats / chat_messages (RLS)
--
-- Problema: además de las policies correctas por tenant (chats_tenant_all /
-- chat_messages_tenant_all), existían policies PERMISIVAS con USING(true):
--   • chats.chats_authenticated         (ALL, authenticated, true)
--   • chat_messages.messages_authenticated (ALL, authenticated, true)
--   • chat_messages.messages_anon_select   (SELECT, anon, true)
--   • chats.chats_anon_insert / messages_anon_insert (INSERT, anon, true)
-- Postgres combina policies permisivas con OR, así que el USING(true) ANULA el
-- scoping por tenant: cualquier usuario autenticado podía leer/editar las
-- conversaciones de TODOS los tenants, y con messages_anon_select hasta un
-- visitante anónimo (la anon key va en el bundle) podía leer todos los mensajes.
-- Impacto medido: 1.719 chats de 364 tenants expuestos.
--
-- Por qué es seguro dropearlas: los flujos entrantes públicos NO usan estas
-- policies — create_chat_for_order y post_demo_customer_message son
-- SECURITY DEFINER (bypassean RLS) y las edge functions (wa/ig/telegram-*)
-- usan service_role. El CRM autenticado ya cumple chats_tenant_all vía
-- users_tenants. otto_ro (bot Slack RO) conserva su policy propia.
-- =============================================================================

drop policy if exists "chats_authenticated" on public.chats;
drop policy if exists "chats_anon_insert"   on public.chats;

drop policy if exists "messages_authenticated" on public.chat_messages;
drop policy if exists "messages_anon_select"   on public.chat_messages;
drop policy if exists "messages_anon_insert"   on public.chat_messages;

-- Quedan vivas, por tabla:
--   chats:         chats_tenant_all (ALL, por users_tenants) + otto_ro_read
--   chat_messages: chat_messages_tenant_all (ALL, por users_tenants) + otto_ro_read
