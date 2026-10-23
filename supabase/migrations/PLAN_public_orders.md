# Plan: pedidos públicos sin fuga entre tiendas (NO aplicado)

Hoy la policy `orders.lectura_publica` (SELECT `true` para anon y authenticated) deja leer
todos los pedidos de todas las tiendas con la anon key (nombre, teléfono, dirección, totales).
El dashboard, POS y app móvil también dependen de ella porque no hay otra policy SELECT.

Objetivo: el cliente sin sesión sigue viendo su pedido después de crearlo, y nadie más.

1. Migración 1 (aditiva, no rompe nada):
   - `orders.public_token uuid not null default gen_random_uuid()` + índice único.
   - RPC `get_public_order(p_token uuid)` SECURITY DEFINER: devuelve solo ese pedido
     (mismos campos que hoy usa la factura).
   - Policy `orders_select_tenant_members`: SELECT con `_pos_can_access_tenant(tenant_id)`
     (dashboard, POS, móvil, equipos, realtime).
2. Frontend (checkout + factura):
   - El checkout genera el token (`crypto.randomUUID()`), inserta el pedido sin `.select()`
     y pide `id` / `order_number` con la RPC.
   - La ruta pasa a `/order/<token>/invoice` (hoy usa el id 1,2,3…, adivinable).
3. Cuando el front esté en producción: migración 2 elimina `lectura_publica`.

Orden importante: front primero, luego quitar la policy. Si se quita antes, el checkout
de los catálogos falla (el insert hace `.select('id')`).
Links viejos con número dejan de abrir (solo se usaban justo después de comprar).
