-- Respuestas citadas (reply-to) en el chat de WhatsApp.
--   wa_message_id      → el wamid de Meta (para mapear citas y, a futuro, recibos).
--   reply_to_message_id → el mensaje (local) al que este responde.
alter table public.chat_messages
  add column if not exists wa_message_id text,
  add column if not exists reply_to_message_id bigint
    references public.chat_messages(id) on delete set null;

create index if not exists chat_messages_wa_message_id_idx
  on public.chat_messages (wa_message_id)
  where wa_message_id is not null;

comment on column public.chat_messages.wa_message_id is 'wamid de WhatsApp Cloud API';
comment on column public.chat_messages.reply_to_message_id is 'Mensaje citado (reply-to)';
