// Documentación pública de la API (se sirve en GET /docs). Mantener al día con index.ts.
export const DOCS_MD = `# CatalogoHoy API

API para que software externo (por ejemplo, agentes de IA) gestione una tienda de CatalogoHoy:
productos, categorías, órdenes, clientes, métricas, configuración y gastos.

**Base URL:** \`https://api.catalogohoy.com/functions/v1/public-api\`

## 1. Token de acceso

El dueño (o un admin) de la tienda crea el token en **Ajustes → API** del panel:

1. Le pone un nombre (ej. "Work by Agents").
2. Elige los permisos (scopes) y, si quiere, una fecha de vencimiento.
3. Copia el token (\`cht_…\`). **Solo se muestra una vez**; CatalogoHoy guarda únicamente su hash.

Cada token da acceso a **una sola tienda**. Se puede revocar en cualquier momento desde el mismo lugar.
El token deja de funcionar si se revoca, si vence, o si quien lo creó deja de ser dueño/admin de la tienda.

Envíalo en cada llamada:

\`\`\`
Authorization: Bearer cht_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

(También se acepta el header \`X-API-Key\`.)

## 2. Permisos (scopes)

| Scope | Permite |
|---|---|
| \`products:read\` | Ver productos y categorías |
| \`products:write\` | Crear, editar, borrar productos; precios en lote; crear categorías |
| \`orders:read\` | Ver órdenes, estados y métricas de ventas |
| \`orders:write\` | Crear, editar, cambiar estado y borrar órdenes; gestionar estados propios |
| \`customers:read\` | Ver clientes |
| \`settings:read\` | Ver configuración de la tienda y tasa de cambio |
| \`settings:write\` | Cambiar configuración, horario, pagos, envíos, WhatsApp, tasa de cambio |
| \`expenses:read\` | Ver gastos y facturas de proveedores |
| \`expenses:write\` | Registrar, editar y borrar gastos |

Una llamada a algo fuera de los scopes del token responde \`403 missing_scope\`.

## 3. Conectar un agente de IA (MCP)

La API es también un servidor **MCP** (Model Context Protocol, transporte Streamable HTTP):

- URL: \`https://api.catalogohoy.com/functions/v1/public-api/mcp\`
- Header: \`Authorization: Bearer cht_…\`

El agente ve automáticamente solo las herramientas que permite su token (\`tools/list\`) y las ejecuta con \`tools/call\`.

Ejemplo de configuración de cliente MCP:

\`\`\`json
{
  "mcpServers": {
    "catalogohoy": {
      "type": "http",
      "url": "https://api.catalogohoy.com/functions/v1/public-api/mcp",
      "headers": { "Authorization": "Bearer cht_…" }
    }
  }
}
\`\`\`

## 4. API REST

| Método y ruta | Qué hace |
|---|---|
| \`GET /v1/me\` | Tienda y permisos del token |
| \`GET /v1/tools\` | Lista de herramientas permitidas con su JSON Schema |
| \`POST /v1/tools/{nombre}\` | Ejecuta una herramienta. Body = argumentos en JSON |
| \`GET /v1/products\` | = \`list_products\` (filtros por query: \`search\`, \`category_id\`, \`limit\`, \`offset\`…) |
| \`GET /v1/products/{id}\` | = \`get_product\` |
| \`GET /v1/orders\` | = \`list_orders\` (query: \`status\`, \`limit\`…) |
| \`GET /v1/orders/{número}\` | = \`get_order\` |
| \`GET /v1/categories\` | = \`list_categories\` |
| \`GET /v1/customers\` | = \`list_customers\` |
| \`GET /v1/store\` | = \`get_store_settings\` |

Respuesta correcta: \`{ "data": … }\`. Error: \`{ "error": { "code": "…", "message": "…" } }\`.

### Ejemplos

\`\`\`bash
# Productos sin foto
curl -H "Authorization: Bearer $TOKEN" \\
  "https://api.catalogohoy.com/functions/v1/public-api/v1/products?has_photos=false"

# Crear un producto con foto
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"name":"Zapato rojo","price":25,"stock":10,"photo_urls":["https://ejemplo.com/zapato.jpg"]}' \\
  https://api.catalogohoy.com/functions/v1/public-api/v1/tools/create_product

# Marcar la orden #120 como pagada
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"order_number":120,"status":"completed"}' \\
  https://api.catalogohoy.com/functions/v1/public-api/v1/tools/set_order_status
\`\`\`

## 5. Herramientas

Productos: \`list_products\`, \`get_product\`, \`create_product\`, \`update_product\`, \`bulk_edit_products\`,
\`delete_product\`, \`adjust_prices\`, \`list_categories\`, \`create_category\`.
Órdenes: \`list_orders\`, \`get_order\`, \`create_order\`, \`update_order\`, \`set_order_status\`,
\`list_order_statuses\`, \`manage_order_status\`, \`delete_order\`, \`get_metrics\`.
Clientes: \`list_customers\`.
Configuración: \`get_store_settings\`, \`update_store_settings\`, \`set_business_hours\`, \`set_whatsapp_sellers\`,
\`set_order_notifications\`, \`manage_payment_method\`, \`manage_shipping_method\`, \`get_exchange_rate\`, \`set_exchange_rate\`.
Gastos: \`list_expenses\`, \`create_expense\`, \`update_expense\`, \`delete_expense\`.

El detalle de cada una (argumentos y tipos) está en \`GET /v1/tools\` o en \`tools/list\` de MCP.

**Fotos y archivos:** se mandan como URLs públicas \`https\` (\`photo_urls\`, \`logo_url\`, \`banner_url\`,
\`attachment_urls\`). JPG, PNG o WEBP (PDF también para gastos), máx. 10 MB cada uno y 20 por llamada.
CatalogoHoy los descarga y los guarda en su CDN.

Las reglas son las mismas del panel: los límites del plan (productos, variantes, órdenes) aplican,
el stock se mueve al crear/cancelar órdenes y los precios están en USD salvo que se indique.

## 6. Límites y registro

- Máximo **120 llamadas por minuto** por token (\`429 rate_limited\`, header \`Retry-After\`).
- Cada llamada queda registrada y el dueño la ve en **Ajustes → API → Actividad**.

## 7. Códigos de error

| HTTP | code | Significado |
|---|---|---|
| 400 | \`invalid_json\` / \`invalid_arguments\` / \`invalid_file\` | Body o archivo inválido |
| 401 | \`unauthorized\` / \`invalid_token\` / \`token_expired\` | Falta el token, no existe, fue revocado o venció |
| 403 | \`missing_scope\` | El token no tiene ese permiso |
| 404 | \`not_found\` / \`unknown_tool\` | Ruta o herramienta inexistente |
| 422 | \`tool_error\` | La acción no se pudo hacer (ej. producto no encontrado, límite del plan) |
| 429 | \`rate_limited\` | Demasiadas llamadas |
| 500 | \`internal_error\` | Error nuestro |
`;
