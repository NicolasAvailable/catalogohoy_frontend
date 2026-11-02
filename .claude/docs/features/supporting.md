# Features — Soporte (rate, reports, analytics, home)

## rate (`@catalogohoy/rate`)

- **Rol**: tasas de cambio para Venezuela (BCV dólar/euro/custom) y conversión de moneda.
- `ExchangeRate` (bcv_usd, bcv_eur, custom_rate, active_rate). `RateStore` con
  `loadRates()` (auto-sincroniza BCV), `updateActiveRate()`, `updateCustomRate()`. Ruta `/admin/rates`.
- Tasas globales en tabla `exchange_rates` (id=1) + `bcv_rates`. La tasa activa define el
  símbolo de moneda en la config del catálogo. BCV se scrapea por edge function (`bcv-rates`).

## reports (`@catalogohoy/reports`)

- **Rol**: reportes (semanales / on-demand) con métricas; compartibles públicamente por token.
- `ReportSnapshot` (orders byStatus, sales USD/Bs + avgTicket + byDay, topProducts, topCustomers,
  paymentMethods) — **inmutable**, computado al crear vía RPC `build_report_snapshot`.
- Rutas admin: `/` (list), `/new` (guard `teamPermissionGuard('reportes','create')`), `/:id`.
  Ruta pública: `public/report/:token` (sin auth, RPC `get_public_report`).
- **Borrado lógico** (`deleted_at`) para mantener el quota honesto (límite por plan).
- El email de reporte semanal lo manda `send-weekly-report` (cron, ver `business-rules.md`).

## expenses (`@catalogohoy/expenses`)

- **Rol**: "Gastos y facturas" (`/admin/expenses`, 2026-10-30, pedido de Distribuidor Motomax):
  la tienda carga facturas de proveedores, compras de mercancía y otros gastos, con foto/PDF,
  categoría, moneda, estado (pagado / por pagar + vencimiento). Vista por mes con totales
  (gastado, pagado, por pagar) y gasto por categoría.
- Tabla `tenant_expenses`. Adjuntos en `attachments` jsonb `[{url,name,type}]` (máx. 10: fotos,
  PDF, Excel/CSV, Word, XML; nunca SVG) a S3 vía `signedUpload(..., 'invoice', tenantId)`
  (`invoices/{tenantId}/…`, mismo prefijo que las facturas de órdenes). Proveedor, monto,
  moneda, categoría, estado y fecha son obligatorios; el resto se marca "(opcional)".
- Avisos de vencimiento por email + WhatsApp: edge `send-expense-reminders` (ver
  `integrations.md`). Opt-out: `users.notify_expense_reminders` (Perfil → Notificaciones).
- Orden de despliegue: migración ANTES del front (el perfil guarda `notify_expense_reminders`).
- Permiso de equipo **`gastos`** (view/create/edit/delete). Es info financiera: los miembros
  sin ese permiso NO la ven (RLS con `_tenant_module_allowed`, no `_pos_can_access_tenant`).
- Totales separados por moneda (USD y Bs no se suman). Pendiente: balance mensual
  gastos vs. ventas / ganancia (siguiente paso).

## analytics (`@catalogohoy/analytics`)

- **Rol**: dashboard de analíticas con PostHog (pageviews, sesiones, usuarios, horas activas,
  navegador/OS/device/idioma). Ruta `/admin/analytics`.
- `AnalyticsService` invoca la edge function `posthog-analytics` con el **slug de la URL**
  (no de localStorage — si no, da analíticas en cero al navegar directo).
- Matriz de horas activas: domingo=0…sábado=6, horas 0-23.

## home (`@catalogohoy/home`)

- **Rol**: dashboard de inicio con KPIs de órdenes del tenant. `HomeStore` lee
  `OrderService.getHomeStats(tenantId)`.
- El **modal de anuncio "Llegó la IA"** ya **no** vive acá: se movió al shell del admin
  (`app-base`, componente `AiAnnouncement` en `apps/catalogohoy/.../layouts/components/ai-announcement/`)
  para que aparezca en **cualquier** vista del admin, no solo el Home. Una vez por **usuario
  autenticado** vía tabla `user_announcement_views` + RPCs `has_seen_announcement`/`mark_announcement_seen`,
  clave `ai_v1`; se abre en `ngAfterViewInit` después de hidratar la sesión. Botones Cerrar /
  Explorar (→ `/admin/products/create`). Imagen hero en `apps/catalogohoy/public/ai-generate-preview.png`.

## core / environments

- Ver `architecture.md` (Core: SupabaseClientProvider, MetaPixel, iconos, PrimeNG; Environments:
  config por sub-módulo, se importa de `@catalogohoy/env`).
