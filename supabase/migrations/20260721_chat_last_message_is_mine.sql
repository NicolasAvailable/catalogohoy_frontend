-- Preview estilo WhatsApp en la lista de chats: "Tú: …" / "<nombre>: …".
-- La mantienen wa-webhook (mensajes/echoes/history), wa-send y el front (demo).
-- Aplicada a prod el 2026-07-21 vía MCP, con backfill desde chat_messages.
alter table chats add column if not exists last_message_is_mine boolean;

update chats c set last_message_is_mine = sub.is_mine
from (
  select distinct on (chat_id) chat_id, is_mine
  from chat_messages
  where not coalesce(is_internal, false)
  order by chat_id, created_at desc
) sub
where sub.chat_id = c.id;
