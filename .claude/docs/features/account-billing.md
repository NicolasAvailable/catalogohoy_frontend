# Features — Cuenta y Billing (plan, payments, profile, tenant, teams, ecommerce-config)

> Números de planes/límites en `business-rules.md`. Acá: cómo está armado cada lib.

## plan (`@catalogohoy/plan`)

- **Rol**: planes (gratis/basico/avanzado/enterprise), límites, expiración/gracia, checkout Stripe.
- **Card Enterprise OCULTA** (2026-07-08): `ENTERPRISE_CARD_VISIBLE = false` en `plans.ts` (app)
  y `Pricing.tsx` (landing) — el grid volvió a 3 columnas. Un tenant que YA es enterprise sí ve
  su card (`plans-grid--four`). El funnel (dialog, edge function, /ventas, panel interno) sigue
  vivo; para re-mostrarla, flip del flag en ambos lados.
- **`PlanStore`** (computed clave): `canCreateProduct/Catalog`, `remainingProducts/catalogs`,
  `currentPlan`, `maxVariants/maxTeamMembers`, `isPlanExpired`, `inGracePeriod`,
  `daysUntilExpiration`, `showExpirationBanner` (≤6 días **y sin auto-renovación**: si
  `tenants.stripe_subscription_status = 'active'` el banner se oculta — Stripe renueva solo;
  solo los planes manuales (pago móvil VE / WhatsApp) ven el banner con "Renovar plan"),
  `currentPlanPalette` (colores por plan). `loadTenantPlanUsage()` se cachea (singleton).
- **`CheckoutService`** invoca edge functions: `create-checkout-session`, `cancel-subscription`
  (⚠️ **no está deployada en prod** — ese flujo falla hoy), `create-catalog-checkout`,
  `update-catalog-slots`, `validate-promotion-code`.
- **Presenter**: `plans` (cards con features; `negative:true` = lo que NO incluye, con X),
  `plan-checkout`, `plan-success`, `expiration-banner`, `plan-expired-dialog`, `plan-limit-dialog`,
  `enterprise-contact-dialog` (funnel multi-step de "Contactar ventas").
- **Enterprise (2026-07-07)**: la fila `enterprise` de la DB se **filtra** del grid de cards y se
  renderiza como banda `.plan-band` debajo (estática). CTA abre `enterprise-contact-dialog`
  (wizard de 5 pasos + resultado, prefill de TenantStore/ProfileStore/TenantCurrencyStore) →
  `EnterpriseLeadService` (infra) → edge function `enterprise-lead`. Scoring/filtro suave y
  Calendly en `domain/enterprise.model.ts` (`scoreEnterpriseLead`, `CALENDLY_ENTERPRISE_URL`).
  `plan-checkout` redirige a `/admin/plans` si el plan no está en `PLAN_BASE_PRICES` (enterprise
  y gratis no tienen checkout). Reglas de negocio y scoring: `business-rules.md → Planes`.
- **Reglas clave**: `max_products = 0` = ilimitado. Catálogos extra son a nivel de **owner**
  (agregados desde cualquier tenant). Expiración = flag **Y** fecha pasada (gracia ~3 días).
  La **mención de créditos** está en `plans.ts` (features de cada plan: 5/150/500).

## payments (`@catalogohoy/payments`)

- **Rol**: solo dominio (sin servicios/stores). Registro de proveedores de pago para órdenes:
  Stripe (global), Mercado Pago (AR/MX/CO/CL/PE/BR/UY), Wompi (CO), Culqi (PE), Flow (CL).
- `PAYMENT_PROVIDERS` + `providersForCountry(code, showAll)`. Credenciales (secretKey) nunca
  vuelven al front tras guardar (edge functions las leen con service_role). Solo api_keys (no OAuth aún).
- Estado del plan de pasarelas: ver `payments-integration-plan.md` (plan Linear CAT-24..30,
  modelo marketplace, MP primero).

## profile (`@catalogohoy/profile`)

- **Rol**: perfil del usuario (nombre, email, foto), lista de tenants, preferencias de notificación.
- `ProfileService.profile()` = RPC `get_my_profile_with_tenants` + hidrata logos desde
  `tenant_ecommerce_config` (denormalizado por perf). `ProfileStore` setea `TenantStore` e
  **identifica al user en PostHog**. `profileResolver` dispara la carga al navegar.
- `deleteAccount()` → edge function `delete-account` → signOut → redirige a `auth.catalogohoy.com`.

## tenant (`@catalogohoy/tenant`)

- **Rol**: núcleo de multi-tenancy. `Tenant` con `url` computada (`custom_domain` o
  `slug.catalogohoy.com`). `TenantStore` resuelve el tenant con prioridad **slug de la URL >
  is_default > primero**; singleton `loadingPromise` (reset en logout).
- `isValidSlug` / `checkSlug` (reintenta 3x). `createCatalog()` → RPC `create_catalog_for_user`.
- `getTenantSlugFromUrl()` saca el slug del subdominio/custom domain (no de localStorage).

## teams (`@catalogohoy/teams`)

- **Rol**: equipo por tenant (1:1), invitaciones, permisos `module:action`, activity log.
- `TeamStore` (members, owners, `canInviteMore` = aceptados < maxTeamMembers) +
  `TeamPermissionsStore` (`can(module, action)` = owner || key en permisos; `hasAccess`).
- Invitar: edge function `invite-team-member` (token + email + permisos). RPCs SECURITY DEFINER
  `get_team_directory` / `get_my_team_permissions` (bypassan RLS de `users` para ver al owner).
- Guard `teamPermissionGuard(module, action)` protege rutas. `no-access-view` si no tiene acceso.

## ecommerce-config (`@catalogohoy/ecommerce-config`)

- **Rol**: configuración del storefront (branding, checkout, envío, horario, moneda, notificaciones).
- `EcommerceConfigService` ↔ tabla `tenant_ecommerce_config` (~26 cols) + `tenant_currency_config`
  + `payment_methods`. Stores: `EcommerceConfigStore`, `TenantCurrencyStore`.
- **Reglas**: `isVisible` (acceso público) / `isAcceptingOrders` (gate del checkout).
  Notificaciones: `notifyNewOrders` (email por orden), `notifyWeeklyReport` (domingos, solo pagos).
  Envíos = JSON array con UUIDs client-side (pickup con lat/lng; delivery/shipping piden dirección).
  Doble moneda: `productCurrency` (storage) vs `displayCurrency` (checkout); tasa BCV
  (`none`/`bcv_usd`/`bcv_eur`/`custom`). Plantilla de WhatsApp con 9 variables (máx 1000 chars).
- **Gotcha**: `get_public_catalog` (RPC) tiene un SELECT estático → columnas nuevas de
  `tenant_ecommerce_config` hay que agregarlas también ahí; la migración del repo está atrás de prod.
- Editor tiene preview en vivo del catálogo vía `postMessage` (`PreviewMessage`) +
  `unsaved-changes.guard`.
- **Cambio de slug** (tab General → card propia "Dirección del catálogo", al final, debajo de
  Comportamiento — botón "Cambiar dirección" con confirm dialog, a propósito FUERA del
  "Guardar cambios" unificado): RPC `change_tenant_slug`
  (security definer) valida owner, formato, unicidad, subdominios reservados y **máx 2 cambios
  por ventana rodante de 30 días** (historial en `tenant_slug_changes`, RLS de lectura para
  miembros). Al guardar con slug cambiado, el admin redirige a
  `https://<nuevo>.catalogohoy.com/admin/catalog/edit?sb-…-auth-token=<token>` — el mismo
  hand-off de sesión por query param que usa el login (AppComponent lo persiste a localStorage
  del origen nuevo). En dev o custom domain solo recarga. Los links/QR viejos con el slug
  anterior dejan de funcionar (no hay redirect del slug viejo).
