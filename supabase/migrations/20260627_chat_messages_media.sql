-- Soporte de multimedia en el chat (WhatsApp): tipo de mensaje + URL del archivo.
-- Los archivos viven en el bucket público `catalogohoy` bajo el prefijo
-- `chat-media/{tenant_id}/...`. message_type por defecto 'text' (no rompe nada).
alter table public.chat_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists media_url text;

comment on column public.chat_messages.message_type is 'text | image | document | audio | video | sticker';
comment on column public.chat_messages.media_url is 'URL pública del archivo (bucket catalogohoy, prefijo chat-media/)';
