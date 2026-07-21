-- Acuses de entrega de WhatsApp para mensajes enviados por el agente:
-- sent → delivered → read (wa-webhook processStatuses; wa-send inserta 'sent').
-- El índice acelera el lookup por wamid (statuses + dedupe del historial).
-- Aplicado a prod el 2026-07-21 vía MCP.
alter table chat_messages add column if not exists delivery_status text;
create index if not exists chat_messages_wa_message_id_idx
  on chat_messages (wa_message_id) where wa_message_id is not null;
