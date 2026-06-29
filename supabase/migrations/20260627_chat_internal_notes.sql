-- Susurros / notas internas del equipo dentro del hilo del chat (estilo Tikket).
-- No se envían al cliente; sólo las ve el equipo.
alter table public.chat_messages
  add column if not exists is_internal boolean not null default false;

comment on column public.chat_messages.is_internal is 'Susurro/nota interna del equipo (no se envía al cliente)';
