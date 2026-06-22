# Features — Commerce (e-commerce, product, order, category, client)

> Storefront público + gestión de catálogo/órdenes/clientes del admin.

## e-commerce (`@catalogohoy/e-commerce`) — storefront público

- **Rol**: catálogo público del comprador (browse, carrito, checkout, recibo). Rutas: `''`
  = catálogo (grid + filtros + paginación), `product/:id`, `checkout`, `order/:id/invoice`.
- **Stores**: `EcommerceStore` (catálogo, productos con paginación, búsqueda/filtro/orden,
  preview overrides para el editor de diseño, tasa de cambio), `CartStore` (carrito en
  localStorage; tiers mayoreo, tallas, variantes; valida stock).
- **Datos**: `EcommerceService.getPublicCatalog()` = **un solo RPC** que trae catalog info +
  categorías + tasa + estado del plan. `getProducts()` con search/category/sort/paginación.
- **Reglas**:
  - Doble moneda (USD + Bs.) **solo VE** (`country_code='VE'`); otros países muestran 1 precio.
  - Plan gratis: solo ve **N productos** en el catálogo (cap se resuelve una vez al cargar).
  - Carrito deduplica por `productId + tierTitle + size + variantId`.
  - `PageSize = 20` hardcodeado en el store.
  - Usar `effectiveCatalogInfo` (mezcla real + preview), no `catalogInfo()` directo.

## product (`@catalogohoy/product`)

- **Rol**: CRUD de productos + IA de imágenes/texto (ver `ai-credits.md`). Rutas:
  `/admin/products` (list), `/create`, `/edit/:id`.
- **Model `Product`**: name, description, price, pricePromotional, photos[], stock (string|null),
  categoryList, sku, productionCost (informativo), position (orden), isWholesale +
  wholesaleTiers[], isSoldOut, isHidden, isSized + sizes[] (stock por talla), isVariant +
  variants[] (precio/foto propia, tallas propias opcionales).
- **Stores/serv**: `ProductStore` (list + loading), `ProductService` (CRUD, search, duplicar,
  borrar, `isLockedByFreePlan()`). `ProductExcelService` (export/import). `AiImageService`
  (fal.ai, ver ai-credits) y `CreditsStore` (saldo de créditos) viven acá.
- **Reglas**: `isHidden` → fuera del catálogo público pero visible en admin. Variantes y tallas
  son conceptos distintos (una variante puede tener tallas). Duplicar **no** clona imágenes
  (referencia las mismas URLs). `position` = orden en el catálogo.
- **Componente exportado**: `CreditsWidgetComponent` (chip de créditos del navbar) se importa
  desde el navbar de la app catalogohoy.

## order (`@catalogohoy/order`)

- **Rol**: ciclo de vida de órdenes (admin). Rutas: `/admin/orders` (list), `/create`, `/edit/:id`.
- **Model `Order`**: orderNumber (#N **por tenant**, distinto del id global), products
  (OrderItem[] con snapshot: precio, sku, size, variantId/variantName, isCustom, description),
  status (`pending`/`completed`/`cancelled`), totales USD/Bs, envío (método/dirección/fee),
  deliveryDate (ISO YYYY-MM-DD), **internalNotes** (chat interno con autor + media, nunca al
  cliente).
- **Stores/serv**: `OrderStore` (list filtrable + `pendingCount` separado para el badge del
  sidebar), `OrderRealtimeService` / `OrderBadgeRealtimeService` (Supabase realtime),
  `OrderPdfService` (PDF). El select de productos al crear orden tiene **buscador** (`[filter]`).
- **Reglas**: orderNumber lo asigna el server al insertar. Status no cascadea. Realtime requiere
  auth activa (si deslogueás, la suscripción puede caer en silencio).

## category (`@catalogohoy/category`)

- **Rol**: categorías (no jerárquicas) para filtrar el catálogo. Rutas: `/admin/categories`, `/edit/:id`.
- **Model**: name, description, isVisible (controla el pill en el catálogo público), position
  (orden ASC), `isViewAll` (la fila sembrada "Ver todos" — no editable/borrable).
- **Gotcha**: borrar una categoría no desasigna automáticamente de los productos.

## client (`@catalogohoy/client`)

- **Rol**: CRM de clientes. Rutas: `/admin/clients` (list), `/:phone` (detalle).
- **Model `Client`**: `phone` = clave natural primaria; name, email, birthday, address, notes,
  referralCode, tags[] (`ClientTag` con color hex), stats (totalOrders, totalSpentUsd/Bs,
  avgOrderUsd, first/lastOrderAt) **computadas server-side** (RPC `get_customers_by_tenant`).
- **Reglas**: clientes se crean manual o se auto-backfillean desde órdenes (nombre/teléfono).
  Tags tenant-scoped para segmentar. Stats son agregados point-in-time (se actualizan al refetch).
  Realtime sobre `customers`.
