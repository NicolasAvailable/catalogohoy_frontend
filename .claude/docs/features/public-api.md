# API pública (tokens por tienda) — 2026-11-05

Pedido de Nicolas: que software externo (primero **Work by Agents**, agentes de IA) gestione
catálogos de clientes de CatalogoHoy.

## Piezas
- **Edge `public-api`** (verify_jwt=false, auth propia). Base: `https://api.catalogohoy.com/functions/v1/public-api`.
  - `GET /docs` docs públicas (markdown, fuente: `public-api/docs.ts`). `GET /v1/me`, `GET /v1/tools`,
    `POST /v1/tools/{name}`, atajos REST `GET /v1/products|orders|categories|customers|store`.
  - `POST /mcp`: servidor MCP (JSON-RPC, Streamable HTTP sin SSE): initialize, tools/list, tools/call.
- **Motor de tools**: `supabase/functions/_shared/catalog-tools.ts` = copia de TOOLS + helpers + runTool de
  `wa-store-bot` (mismas reglas de stock, órdenes, Bs, estados, gastos). El bot sigue con su propia copia:
  **si cambias una tool del bot, replícala aquí** (pendiente: que el bot importe el módulo).
  - La API traduce URLs (`photo_urls`, `logo_url`, `banner_url`, `attachment_urls`) a "fotos pendientes":
    descarga (https, ≤10 MB, jpg/png/webp, pdf en gastos) y sube a S3 `api/{tenantId}/…`.
  - No expone `send_products` ni `discard_photos` (son de WhatsApp).
- **DB** (migración `20261105_public_api_tokens.sql`): `api_tokens` (hash SHA-256, prefix, scopes, expires,
  revoked) y `api_request_log`. RLS on sin policies. RPCs `api_tokens_list`, `api_token_create` (devuelve el
  token en claro una sola vez), `api_token_revoke`, `api_request_log_list`: exigen owner/admin
  (`api_tenant_admin_user`).
- **Panel**: pestaña **API** en Perfil (`/admin/profile?tab=api`, componente `libs/catalogohoy/profile/src/presenter/api-access`). Nicolas no la quiere en el menú lateral.

## Reglas de seguridad
- Token `cht_` + 48 hex. El tenant sale SIEMPRE del token. Scopes: `{products,orders,settings,expenses}:{read,write}`,
  `customers:read`. Máx. 10 tokens activos por tienda.
- El token muere si se revoca, vence, o su creador deja de ser owner/admin.
- 120 llamadas/min por token (contando `api_request_log`; env `PUBLIC_API_RATE_LIMIT`).
- Disponible para todos los planes (los límites de plan los ponen los triggers de products/orders).
- A futuro: OAuth para que terceros pidan acceso sin que el dueño copie tokens.
