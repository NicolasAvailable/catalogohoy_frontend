# Venta de dominios (Namecheap)

Estado: código en PR, **no en producción** hasta tener la API de Namecheap, el
servidor puente y el token de Vercel. Plan: https://claude.ai/artifact/4Bnf8DZvLxpsCAa7YJVgKP

## Qué hace
Perfil → pestaña **Dominio**: la tienda busca un dominio, ve el precio anual,
paga con Stripe (suscripción anual) y el dominio queda conectado solo
(`tenants.custom_domain`).

## Piezas
| Pieza | Dónde |
| --- | --- |
| Puente con IP fija (Namecheap solo acepta IPs en lista blanca; Supabase no tiene IP fija) | `services/domain-bridge/` (Node sin dependencias, AWS Lightsail) |
| Lógica compartida (precio, máquina de estados, Vercel, reembolso, renovación) | `supabase/functions/_shared/domains.ts` |
| API para la app + cron | edge `domains` (`search`, `checkout`, `status`, `cancel`, `provision`) |
| Pago, renovación y cancelación | `stripe-webhook` (metadata `type=domain`, **sin** `tenant_id` para que los handlers de planes la ignoren) |
| Tabla | `tenant_domains` (RLS: miembros leen, solo service_role escribe) — `20261115_tenant_domains.sql` |
| UI | `libs/catalogohoy/profile/src/presenter/domain-shop/` |

## Estados
`pending_payment → paid → registering → registered → connecting → active`;
si la compra falla: `refunded` (reembolso automático en Stripe); sin pagar 24 h:
`abandoned`; renovación cancelada: `canceled` → al vencer `expired` y el
catálogo vuelve a `slug.catalogohoy.com`. Cada transición es un UPDATE
condicional (`status = esperado`): webhook, cron y polling no compran dos veces.
Un error de red al registrar NO reembolsa a ciegas: queda en `registering` y avisa a Slack.

## Precio (reglas de negocio)
- Fórmula: (costo + margen + $0.30) ÷ 0.956, redondeado a .99 (0.956 cubre Stripe internacional ~4.4%).
- **Primer año** = costo de registro + `DOMAIN_FIRST_YEAR_MARGIN_USD` (default $13.99; Nicolas 2026-11-15).
  Se cobra con un cupón de una sola vez sobre la primera factura de la suscripción.
- **Renovación** (cada año después) = costo de renovación + `DOMAIN_MARGIN_USD` (default $10).
  Ej.: .com $27.99 el 1er año, luego $31.99/año; .xyz/.online/.store $16.99 el 1er año.
- La app busca sola 2 s después de que el cliente deja de escribir (y con el botón Buscar), con esqueleto mientras carga. No se vende si el costo pasa de `DOMAIN_MAX_COST_USD` ($60) ni dominios premium.
- TLDs: com, net, xyz, online, store, shop, site, co.
- Titular: CATALOGOHOY, LLC. Sin reembolso después de registrado (se avisa en el checkout).
- Una tienda = un dominio comprado vivo a la vez. No toca dominios conectados a mano.

## Secretos
- Edge `domains` / `stripe-webhook`: `DOMAIN_BRIDGE_URL`, `DOMAIN_BRIDGE_SECRET`, `DOMAINS_CRON_SECRET`,
  `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT` (catalogohoy-dashboard), opcionales `DOMAIN_MARGIN_USD`,
  `DOMAIN_MAX_COST_USD`, `DOMAIN_LOW_BALANCE_USD` (aviso Slack, default $15).
- Vault: `domains_cron_secret` (mismo valor que `DOMAINS_CRON_SECRET`) para el cron cada 5 min.
- Servidor puente: ver `services/domain-bridge/env.example`.

## Pendiente (v2)
Correo/WhatsApp al cliente cuando el dominio queda activo; mostrar dominios vendidos en el panel interno.
