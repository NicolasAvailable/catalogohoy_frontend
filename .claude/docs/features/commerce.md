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
  - **Contado y crédito en el checkout** (pedido Moto Fox, 2026-09-28; extensión de CAT-74):
    opt-in por catálogo en Editar catálogo → Pagos (card "Contado y crédito", TODO apagado por
    default). `applyAdjustmentsInCheckout` = el ajuste `__adjust*` del método elegido se aplica
    al resumen/total/mensaje WA y se guarda como snapshot `orders.payment_adjustment` (misma
    forma que el admin → la factura pública y el PDF lo itemizan). `creditEnabled` = selector
    "¿Cómo quieres pagar?"; crédito gateado por `creditMinPurchases` compras previas por
    teléfono (RPC `get_customer_purchase_count`, debounce, fallback PERMISIVO si el RPC falla).
    La orden a crédito nace `pending` + `orders.payment_condition='credit'` (NUNCA status
    `credit` directo: eso descuenta stock y lo decide el comerciante) → chip "Solicitó crédito"
    en el listado + aviso en order-save. Config dentro de `customer_fields` jsonb.

## product (`@catalogohoy/product`)

- **Rol**: CRUD de productos + IA de imágenes/texto (ver `ai-credits.md`). Rutas:
  `/admin/products` (list), `/create`, `/edit/:id`.
- **Model `Product`**: name, description, price, pricePromotional, photos[], stock (string|null),
  categoryList, sku, productionCost (informativo), position (orden), isWholesale +
  wholesaleTiers[], isSoldOut, isHidden, isSized + sizes[] (stock por talla), isVariant +
  variants[] (precio/foto propia, tallas propias opcionales).
- **Stores/serv**: `ProductStore` (list + loading), `ProductService` (CRUD, search, duplicar,
  borrar, `isLockedByFreePlan()`). `ProductExcelService` (import + plantilla; su `exportToExcel`
  ya no se usa desde la UI). `AiImageService` (fal.ai, ver ai-credits) y `CreditsStore`
  (saldo de créditos) viven acá.
- **Exportar productos**: ya **no** se genera el Excel en el navegador. El tile "Exportar" del
  hub (`import-export-hub`) abre WhatsApp de soporte (`wa.me/584220240947`, mismo número que
  usa el módulo plan) con mensaje prellenado que incluye el slug del tenant; el equipo envía el
  archivo manualmente. Sigue gateado a planes pagos (free = tile deshabilitado con badge Pro).
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
- **Stock (fix 2026-07-09)**: el inventario se mueve al cruzar la frontera `completed`
  (entrar descuenta, salir repone) vía RPCs `decrement/increment_product_stock`
  (SECURITY DEFINER). Cubre los TRES caminos: cambio de status (lista/modal),
  **crear una orden ya completada** y **editar una orden cambiando su status**
  (estos dos últimos no descontaban antes). Editar los items de una orden ya
  completada repone lo viejo y descuenta lo nuevo. Semántica de variantes: la
  variante SIN talla descuenta el **stock del producto** (las variantes comparten
  stock, solo sus tallas tienen stock propio); antes la RPC las salteaba (bug).
  `stock NULL` = sin control de inventario (se saltea a propósito). Si el RPC
  falla, ahora sale un toast de aviso (antes se tragaba en console.warn).

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

## POS — Punto de Venta (`apps/catalogohoy/src/app/modules/pos/`, ruta `/pos`)

- Full-screen fuera del layout admin; gate por plan (Avanzado/Enterprise, `posEnabledGuard`).
  Settings en `pos-settings.store.ts` (localStorage por tenant): medios de pago, ticket
  (header/footer/logo), impresora térmica (WebUSB ESC/POS, 58/80 mm) y **tamaño del recibo
  imprimible** (`ticket.format`: 58 | 80 | media-carta | carta — los dos últimos con layout de
  factura; generadores `ticketReceiptHtml`/`sheetReceiptHtml` en `views/venta/venta.ts`).
- **IVA (CAT-84)**: `buildTaxLine` (venta.ts) agrega el desglose informativo del impuesto del
  catálogo (`tenant_ecommerce_config.tax_rate/tax_label`) a los 3 formatos de recibo.
- **Offline F1+F2 (CAT-85)** — `offline/pos-offline.store.ts`:
  - F1: espejo de productos/config/tasa en IndexedDB al cargar con red; sin red se siembra vía
    `ProductStore.set` + `hydrate()` (EcommerceConfigStore/RateStore).
  - F2: cobrar sin red encola la venta (uuid → `orders.pos_client_id`, índice único por tenant,
    migración `20261006_orders_pos_client_id.sql`) y sincroniza FIFO en el evento `online`;
    duplicado (23505) = ya sincronizada; stock se descuenta al sincronizar. Chips de estado en el
    topbar del shell y badge en la pantalla de éxito.
  - Alcance: sesión ya abierta (corte de luz a mitad de jornada). F3 (service worker para abrir
    sin red + reconciliación multi-dispositivo) pendiente.
- ⚠️ Gotcha: todo ícono nuevo debe registrarse en
  `libs/catalogohoy/core/src/providers/icons/providers/lucide.provide.ts` (import + lista); un
  ícono sin registrar rompe el render del componente a mitad de change detection.
