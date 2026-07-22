-- Contador de no-leídos REAL en DB (bug: wa-webhook decía "lo maneja un
-- trigger en prod" y el trigger no existía → chats.unread_count quedaba en 0
-- y el badge del sidebar solo funcionaba con la app abierta).
-- Canal-agnóstico: sirve para WhatsApp, Instagram y lo que venga.
-- Aplicado a prod el 2026-07-22 vía MCP.
create or replace function bump_chat_unread() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Solo mensajes entrantes del cliente, y solo si son "en vivo" (el import
  -- de historial inserta con timestamps viejos y no debe contar como no leído).
  if new.is_mine = false
     and coalesce(new.is_internal, false) = false
     and new.created_at > now() - interval '2 minutes' then
    update chats set unread_count = coalesce(unread_count, 0) + 1
    where id = new.chat_id;
  end if;
  return new;
end $$;

drop trigger if exists chat_messages_bump_unread on chat_messages;
create trigger chat_messages_bump_unread
  after insert on chat_messages
  for each row execute function bump_chat_unread();
