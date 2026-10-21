-- Blindaje del bot de WhatsApp y de los créditos de IA (2026-10-21).
-- Solo las edge functions (service_role) tocan estas tablas y funciones.
-- Las tablas ya tienen RLS sin políticas; además se quitan los permisos de
-- anon/authenticated para que ni una política futura las abra por error.

revoke all on table public.wa_bot_link_codes, public.wa_bot_link_attempts, public.wa_bot_sessions,
  public.wa_bot_usage, public.wa_bot_msg_refs, public.wa_bot_messages from anon, authenticated;
-- wa_bot_links tiene políticas de lectura/borrado para miembros de la tienda.
revoke all on table public.wa_bot_links from anon;

-- Créditos de IA: cualquiera con la llave pública podía regalarse o gastarle
-- créditos a otro usuario. Solo las edge functions las llaman.
revoke execute on function public.ensure_ai_credits(bigint), public.spend_ai_credits(bigint, integer),
  public.refund_ai_credits(bigint, integer), public.add_purchased_credits(bigint, integer),
  public.wa_bot_push_photo(text, bigint, text)
  from public, anon, authenticated;

-- Panel interno: requiere sesión (además del chequeo de email adentro).
revoke execute on function public.wa_bot_admin_stats(), public.wa_bot_admin_messages(bigint, text, bigint, integer)
  from public, anon;
grant execute on function public.wa_bot_admin_stats(), public.wa_bot_admin_messages(bigint, text, bigint, integer)
  to authenticated;
