-- =============================================================================
-- Dedupe de chats por teléfono + nombre desde customers (alias del CRM)
--
-- Problema: `create_chat_for_order()` insertaba un chat NUEVO por cada orden →
-- múltiples chats vacíos por el mismo cliente. Y el nombre del chat venía de la
-- orden suelta, no del alias registrado en `customers`.
-- =============================================================================

-- 1) El trigger de órdenes pasa a find-or-create por teléfono normalizado,
--    prefiriendo el alias registrado en customers.
CREATE OR REPLACE FUNCTION public.create_chat_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_phone text := regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g');
  existing_id bigint;
  alias text;
BEGIN
  IF v_phone <> '' THEN
    SELECT id INTO existing_id
    FROM chats
    WHERE tenant_id = NEW.tenant_id
      AND regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g') = v_phone
    ORDER BY id
    LIMIT 1;

    SELECT name INTO alias
    FROM customers
    WHERE tenant_id = NEW.tenant_id
      AND regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone
      AND name IS NOT NULL AND name <> ''
    ORDER BY id
    LIMIT 1;
  END IF;

  IF existing_id IS NOT NULL THEN
    UPDATE chats
    SET order_id = COALESCE(order_id, NEW.id),
        customer_name = COALESCE(alias, customer_name)
    WHERE id = existing_id;
  ELSE
    INSERT INTO chats (tenant_id, order_id, customer_name, customer_phone)
    VALUES (NEW.tenant_id, NEW.id, COALESCE(alias, NEW.name, 'Cliente'), NEW.phone);
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Cuando se crea/edita un cliente, su nombre (alias) manda en el chat.
CREATE OR REPLACE FUNCTION public.sync_chat_name_from_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_phone text := regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g');
BEGIN
  IF NEW.name IS NOT NULL AND NEW.name <> '' AND v_phone <> '' THEN
    UPDATE chats
    SET customer_name = NEW.name
    WHERE tenant_id = NEW.tenant_id
      AND regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g') = v_phone;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_chat_name_from_customer ON public.customers;
CREATE TRIGGER trg_sync_chat_name_from_customer
AFTER INSERT OR UPDATE OF name ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.sync_chat_name_from_customer();

-- 3) Dedupe one-time: borrar los chats VACÍOS duplicados (mismo tenant+teléfono
--    que otro chat "mejor": con mensajes, o de menor id). Nunca borra un chat
--    con mensajes; deja exactamente uno por teléfono.
DELETE FROM public.chats c
WHERE NOT EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.chat_id = c.id)
  AND regexp_replace(coalesce(c.customer_phone, ''), '\D', '', 'g') <> ''
  AND EXISTS (
    SELECT 1 FROM public.chats c2
    WHERE c2.id <> c.id
      AND c2.tenant_id = c.tenant_id
      AND regexp_replace(coalesce(c2.customer_phone, ''), '\D', '', 'g')
          = regexp_replace(coalesce(c.customer_phone, ''), '\D', '', 'g')
      AND (
        EXISTS (SELECT 1 FROM public.chat_messages m2 WHERE m2.chat_id = c2.id)
        OR c2.id < c.id
      )
  );

-- 4) Refrescar el nombre de los chats restantes desde el alias de customers.
UPDATE public.chats c
SET customer_name = sub.name
FROM (
  SELECT DISTINCT ON (tenant_id, regexp_replace(coalesce(phone, ''), '\D', '', 'g'))
    tenant_id,
    regexp_replace(coalesce(phone, ''), '\D', '', 'g') AS phone_n,
    name
  FROM public.customers
  WHERE name IS NOT NULL AND name <> ''
  ORDER BY tenant_id, regexp_replace(coalesce(phone, ''), '\D', '', 'g'), id
) sub
WHERE sub.tenant_id = c.tenant_id
  AND sub.phone_n = regexp_replace(coalesce(c.customer_phone, ''), '\D', '', 'g')
  AND sub.phone_n <> '';
