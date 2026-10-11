# Apps móviles (iOS / Android) — Ionic + Capacitor

App nativa del **comerciante** (admin), reusando la app Angular `catalogohoy` dentro
de un shell Capacitor. El storefront público **no** va a la app: vive en la web
(link por tenant). Prioridad de producto: **push de órdenes/CRM**.

> Decisión: **Ionic + Angular + Capacitor** (no React Native ni nativo por plataforma).
> Motivo: el admin ya está en Angular y maduro → RN daría cero reuso y dos frontends
> que mantener; nativo sería 2-3x el trabajo sin ganancia para un CRUD + chat + fotos.
> Push por **FCM directo** (tokens en Supabase, envío en edge functions, mismo patrón
> que WhatsApp/email — sin terceros nuevos).

## Estado

- **Fase 0 (shell nativo) — ✅ COMPLETA (2026-09-04).**
- **Fase 1a (entry-point nativo: login in-app → slug → /admin) — ✅ CÓDIGO LISTO (2026-09-04),
  compila web+nativo; falta verificar on-device.**
- **Fase 1b (push FCM) — 🟡 CÓDIGO LISTO (front + migración + edge fn), BLOQUEADO en el
  setup de Firebase del dueño + prueba on-device. Migración/edge fn NO aplicadas a prod aún.**
- **Fase 2 (pulido + stores) — pendiente.**

## Fase 1a — Entry-point nativo (implementado)

Problema: en nativo `hostname = localhost` → `getTenantSlugFromUrl()` caía a `DEV_TENANT_SLUG`
y el login redirigía a `auth.catalogohoy.com` (fuera del shell). El build de producción NO
saltea auth (el `authenticationGuard` usa `isDevMode()` de `@angular/core`, false en prod).

Cambios (todos **aditivos + gateados a nativo**, web intacto — build de `authentication` ✅):
- `@catalogohoy/core` (`tenant.constant.ts`): `isNativeApp()` (= `Capacitor.isNativePlatform()`),
  cache de slug nativo `setNativeSlug`/`getNativeSlug`/`clearNativeSlug` (persistido en `localStorage.slug`).
- `getTenantSlugFromUrl()` (tenant): rama nativa → devuelve `getNativeSlug()`.
- `authenticationGuard` (auth): nativo + sin sesión → `router.parseUrl('/login')` in-app
  (nada de redirect externo). `inject(Router)` antes del primer `await`.
- `authentication.service.ts` + facade: nuevo `getMyTenantSlug()` (RPC `get_my_tenant` → slug).
- Componente `Login` (`@catalogohoy/auth`): en nativo `send()` → `getMyTenantSlug()` → `setNativeSlug`
  → `router.navigateByUrl('/admin')` (no `window.location.href`). Oculta Google/forgot/signup en nativo.
- App `catalogohoy`: ruta `/login` (lazy `Login`) + `nativeEntryGuard` en `''` (nativo con sesión →
  resuelve slug via `get_my_tenant` → `/admin`; sin sesión → `/login`; web = no-op).
- ⚠️ Google OAuth nativo NO implementado (necesita deep-links) → login nativo = email/contraseña.

### Logout nativo (fix 2026-10-02)

Caso simétrico del entry-point: los handlers de "Cerrar sesión" hacían
`window.location.href = 'https://auth.catalogohoy.com'` incondicionalmente, lo que en
nativo **saca al usuario del shell** (navega el WebView al sitio web externo, otro origen)
y parece "no cerró la sesión" (el shell nativo nunca re-evalúa su sesión ya limpia).
`auth.logout()` / `signOut()` **sí** limpia la sesión del localStorage del origen nativo;
el problema era solo el redirect. Fix: gatear por `isNativeApp()` → `clearNativeSlug()` +
`window.location.href = '/login'` (hard-reload in-app, re-scopea stores; mismo patrón que
`switchCatalog`). En web, intacto. Archivos: `sidebar.ts`, `profile-menu.ts`,
`mobile-more-drawer.ts` (los 3 handlers de logout) + `profile.service.ts` `deleteAccount()`.
Requiere nuevo build nativo (`npm run mobile:build`) + resubir a las stores para que llegue.

### Otras vistas con el mismo patrón (fix 2026-10-02)

Barrido de TODOS los `window.location.href = 'https://…catalogohoy.com'` que sacan del shell
en nativo. Gateados por `isNativeApp()` → `setNativeSlug(nuevoSlug)` + nav in-app:
- `ecommerce-config/create-catalog.ts` — crear catálogo (alcanzable desde el drawer "Más") →
  `setNativeSlug` + `/admin` en vez de `https://slug.catalogohoy.com/admin`.
- `ecommerce-config/ecommerce-config.ts` `redirectToNewSlug()` — cambiar slug → `setNativeSlug` +
  `/admin/catalog/edit` (en web usa hand-off de token por query al subdominio nuevo).
- `tenant/catalog-unavailable-view.ts` `goHome()` — nativo → `/login` (no hay landing en el shell).
- `teams/no-access-view.ts` `goToOwnStore()`/`createStore()` — nativo → `setNativeSlug` + `/admin` / `/login`.

Ya nativo-safe de antes (NO tocar): `authentication.guard.ts` (sin sesión → `/login` in-app) y
`authentication.service.ts` `forgottenPassword()` (base URL gateada). Share/referral/help/WhatsApp-bridge
usan URLs externas **a propósito** (no son navegación del shell).

### Deeplinks (estado 2026-10-02): NO existen

No hay Universal Links (iOS Associated Domains / AASA), ni App Links (Android assetlinks + intent-filter),
ni listener `App.addListener('appUrlOpen')`. El único `CFBundleURLScheme` es el reversed-client-id de
Google (callback del Sign-In nativo). El signup nativo es **in-app** (email/contraseña Y social via
`needsStoreSetup`), así que NO hay round-trip a la web para registrarse → los deeplinks web→app no son
necesarios hoy. Se justificarían a futuro solo para "abrir en la app" desde links de marketing/emails,
lo cual además requiere transferir la sesión cross-origin (patrón del `?sb-…-auth-token=` del login web).

## Fase 1b — Push FCM (implementado, pendiente Firebase)

Plugin: **`@capacitor-firebase/messaging`** (NO `@capacitor/push-notifications`, que en iOS da
token APNs, no FCM). Import **dinámico** en `PushService` → Firebase queda en un chunk nativo,
fuera del bundle web. Se quitó `@capacitor/push-notifications` para no duplicar el delegate APNs.

- `apps/catalogohoy/src/app/mobile/push.service.ts`: pide permiso, `getToken()` (FCM), guarda en
  `device_push_tokens` (upsert onConflict `token`), re-guarda en `tokenReceived`, deep-link en
  `notificationActionPerformed` (`data.route`). Se llama desde `layouts/layout.ts` (ngOnInit, admin).
- DB: `supabase/migrations/20260904_device_push_tokens.sql` (tabla + RLS por `auth_user_id`).
- Edge fn: `supabase/functions/send-push-notification/index.ts` — FCM HTTP v1 (JWT service account
  → OAuth token → send por token), auth `x-webhook-secret`, resuelve destinatarios por `authUserIds`
  o `tenantId` (users_tenants→users→auth_user_id), limpia tokens muertos (UNREGISTERED).
  Secrets: `PUSH_WEBHOOK_SECRET`, `FCM_SERVICE_ACCOUNT` (JSON), + SUPABASE_URL/SERVICE_ROLE_KEY.
- **Falta (dueño)**: crear proyecto Firebase, `GoogleService-Info.plist` (iOS) en `ios/App/App/`,
  subir APNs `.p8` a Firebase, setear secrets, aplicar migración + deploy edge fn, y **enganchar** el
  envío en `send-order-notification` (prod, no está en repo — ver [[edge-functions-not-in-repo]]) y
  en los webhooks de CRM. Capability "Push Notifications" + Background Modes en Xcode.

## Qué se montó en Fase 0

- Deps: `@capacitor/core|cli|ios|android`, `@ionic/angular` (v9.0.2, soporta Angular 20),
  plugins `@capacitor/app|status-bar|splash-screen|keyboard|push-notifications` (todos v8).
- `capacitor.config.ts` (raíz): `appId: com.catalogohoy.app`, `appName: CatalogoHoy`,
  `webDir: dist/apps/catalogohoy/browser` (output del builder `@angular/build:application`).
  Live-reload por env `CAP_SERVER_URL` (IP LAN de la Mac).
- `NativePlatformService` (`apps/catalogohoy/src/app/mobile/`): status bar, esconde el
  splash cuando Angular montó, botón atrás de Android → back/minimize. **No-op en web.**
  Se invoca desde `App` (app.ts). **No hace routing** (ver gotcha del slug).
- `provideIonicAngular({ mode: 'ios' })` en `app.config.ts`. **Ionic 9**: `provideIonicAngular`
  se importa de `@ionic/angular/provide` (NO existe `@ionic/angular/standalone`); los
  componentes de `@ionic/angular/ion-*`. No se importó CSS global de Ionic (evita pisar
  PrimeNG/Tailwind); se adopta por componente cuando se construya la primera pantalla nativa.
- `index.html`: `viewport-fit=cover`. `styles.css`: variables `--safe-area-*` + utilidades
  `.pt-safe`/`.pb-safe`.
- Scripts npm: `mobile:build` (nx build + cap sync), `mobile:sync`, `mobile:copy`,
  `mobile:ios`, `mobile:android`.
- Plataforma **iOS agregada** (`ios/`, Capacitor 8 usa Swift Package Manager, sin Podfile).

## Toolchain de la Mac (verificado 2026-09-04)

- Xcode 26.6 ✅ · CocoaPods 1.16.2 ✅ · Capacitor CLI 8.5.1 ✅
- **Android: falta** Java (JDK) + Android SDK/`ANDROID_HOME`. Instalar Android Studio +
  JDK 17 y recién ahí `npx cap add android`.

## Cómo correr (dev)

```bash
# 1) Build web + sync a nativo
npm run mobile:build
# 2) Abrir en Xcode y correr en simulador/dispositivo
npm run mobile:ios

# Live-reload sobre el dispositivo (sin rebuild):
export CAP_SERVER_URL=http://<IP-LAN-de-tu-Mac>:4200
npm run serve:catalogohoy   # en otra terminal
npm run mobile:sync && npm run mobile:ios
```

## GOTCHA crítico — entry-point nativo (bloquea Fase 1)

El admin (`/admin`) está gateado por **`isValidSlugGuard`**: necesita un slug de tenant
en `localStorage` (en web viene del query param / subdominio). **En nativo no hay slug**,
así que un redirect ciego a `/admin` rompe (cae en `catalog-unavailable`).

→ Primera tarea de Fase 1: tras el login, **resolver el slug del tenant desde el perfil**
del usuario, guardarlo en `localStorage` y recién ahí navegar a `/admin`. Detectar nativo
con `Capacitor.isNativePlatform()` (expuesto por `NativePlatformService.isNative`).

## Fase 1 — Push de órdenes/CRM (plan)

1. **Front** `PushService`: `PushNotifications.requestPermissions()` + `register()`;
   en `'registration'` guardar el token; en `'pushNotificationActionPerformed'` deep-link
   a la orden/chat. Solo en nativo.
2. **DB** tabla `device_push_tokens (user_id, token, platform, app_version, updated_at,
   unique(token))` con RLS (cada user ve/gestiona solo los suyos).
3. **Edge fn** `send-push-notification` (FCM HTTP v1, JWT de service account),
   clonando el patrón de `send-whatsapp-notification`. Secret `FCM_SERVICE_ACCOUNT`.
4. **Hooks**: `send-order-notification` (⚠️ vive en prod, **no está en el repo** — hay que
   versionarla) → push al owner ante orden nueva; webhooks de CRM (WA/IG/Messenger) → push
   ante mensaje entrante.

## Prerequisitos del dueño (manuales, fuera de código)

- **Apple Developer Program** ($99/año): signing + APNs key `.p8` + TestFlight.
- **Google Play Console** ($25 única vez).
- **Proyecto Firebase** (gratis): FCM; subir la APNs `.p8` para iOS.
- Para Android: Android Studio + JDK 17.

## Compliance Apple 3.1.1 (In-App Purchase) — barrido 2026-10-06

Apple rechazó la 1.0 (5) (submission 6d1ea7db, revisado en iPad Air M3) por Guideline
3.1.1: la app mostraba/enlazaba la compra de planes (Stripe) sin ofrecer IAP. Decisión:
**en el build nativo no existe NINGUNA superficie de compra/upsell** (modelo Shopify);
la suscripción se gestiona solo en la web y la app ni la menciona (dirigir a comprar
fuera de la app también viola 3.1.1 fuera del storefront de EE.UU.).

Patrón: `isNativeApp()` de `@catalogohoy/core` (`tenant.constant.ts`). Superficies
gateadas (además de las previas: navbar nativo sin chip plan/créditos, checkout
bloqueado, expiration-banner y plan-expired-dialog sin CTAs):

- `plan.routes.ts` → `webOnlyGuard`: `/admin/plans`, `checkout/:planId` y `success`
  redirigen a `/admin` en nativo (los precios de `plans.html` quedan inalcanzables);
  `terms` sigue accesible (lo usa el registro).
- Home: banner promo "planes anuales -50%" oculto (`home.html`).
- Checklist getting-started: pasos `locked` (upsell "Ver planes") filtrados en nativo.
- `plan-limit-dialog`: sin párrafo "Mejora tu plan" ni botón "Ver planes".
- Gate POS (`pos-intro.html`) y gate Chats (`connect-channels.html`): texto neutro
  "Esta función no está disponible en tu plan actual." sin CTA.
- `ui-premium-upgrade-prompt`: nuevo input `showCta` (los consumidores Equipo y
  Analíticas pasan `!isNative` + descripción neutra).
- Equipo header: botón "Mejorar plan" (team lleno) → "Invitar miembro" deshabilitado.
- Crear catálogo: sin compra de slots (card neutra de límite) ni CTA "Ver planes".
- `plan-expired-dialog`: en nativo ya no menciona "versión web" (texto neutro).

i18n: 4 claves nuevas en es/en/fr/pt. Si se agrega CUALQUIER upsell/precio nuevo,
gatearlo con `isNativeApp()` o Apple lo rechaza en la próxima review.

### ⭐ Hallazgo clave del rechazo (captura del revisor)
La captura adjunta al rechazo (`Screenshot-1006-14809PM.png`) era **Perfil → pestaña
Suscripción → "Tu plan incluye"** (profile.html) — NO la página de Planes. Fix: la
pestaña "Suscripción" del Perfil se filtra completa en nativo (`profile.ts` tabs +
guard del query param `?tab=subscription`). Esa pestaña contenía además "Cambiar
tarjeta" (portal Stripe = mecanismo de pago externo), "Cancelar suscripción",
historial de pagos y el upsell "Explorá los planes disponibles". Lección: al auditar
3.1.1 revisar también vistas de CUENTA (perfil/billing), no solo las de compra.
