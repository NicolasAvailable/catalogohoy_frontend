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
