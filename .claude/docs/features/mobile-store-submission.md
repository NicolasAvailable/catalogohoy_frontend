# Mobile — App Store & Play Store submission kit

Reference for publishing the **CatalogoHoy merchant admin** native apps (iOS + Android).
The native app is the **merchant/admin** experience only (manage catalog, orders, CRM, metrics).
The public storefront stays on the web. Build/setup state lives in the `mobile-apps-state`
memory + [`mobile-apps.md`](./mobile-apps.md); this file is the **store-listing** content.

## App identity (must match everywhere)

| Field | Value |
| --- | --- |
| App name (stores) | **CatalogoHoy** |
| Bundle ID (iOS) / applicationId (Android) | `com.catalogohoy.app` |
| Version / build | `1.0.0` (build 1 / versionCode 1) |
| Category | Business (primary) · Shopping (secondary) |
| Content rating | 4+ / Everyone (no objectionable content) |
| Default language | Spanish (es) |
| Legal entity | CatalogoHoy, LLC — 8947 Western Pines Drive, Douglasville, GA 30134, US |

## Required URLs — ✅ VERIFIED LIVE (2026-09-08, rendered via Playwright, HTTP 200)

- **Privacy policy:** https://catalogohoy.com/privacy-policy  → "Política de Privacidad" ✅
- **Terms:** https://catalogohoy.com/terms-of-service  → "Términos de Servicio" ✅
- **Data deletion:** https://catalogohoy.com/data-deletion  → "Eliminación de Datos" ✅
  (satisfies Play's account/data-deletion requirement)
- **Support URL:** https://catalogohoy.com
- **Marketing URL (optional):** https://catalogohoy.com
- **Support email:** nicolas@catalogohoy.com

> Note: the landing is a client-rendered SPA (no SSR), so a non-JS crawler sees only the app
> shell. Real browsers (what Apple/Google reviewers use) render the full policy correctly.
> Routes live in `apps/landing/src/App.tsx` (`/privacy-policy`, `/terms-of-service`,
> `/data-deletion`), linked from the footer.

## Short description / subtitle

- **iOS subtitle (≤30 chars):** `Tu negocio en el bolsillo`
- **Android short description (≤80 chars):** `Gestioná tu catálogo, pedidos y clientes desde el celular. Todo en un lugar.`

## Full description (ES — reuse for both stores)

```
CatalogoHoy es la app para dueños de negocio: administrá tu catálogo online, recibí
pedidos y atendé a tus clientes desde el celular, estés donde estés.

• Catálogo: creá y editá productos, precios, variantes, categorías e imágenes.
• Pedidos: mirá los pedidos del día, su estado y el detalle; registrá ventas.
• Clientes y mensajes: llevá tu CRM y respondé consultas.
• Métricas: ventas del día, del mes y evolución en el tiempo.
• Notificaciones: enterate al instante cuando entra un pedido nuevo.

Tu tienda pública sigue online 24/7; con la app la administrás en segundos.

La compra y gestión de planes se realiza en catalogohoy.com.
```

> The last line is deliberate: purchases are web-only (IAP compliance — see
> `mobile-apps-state`). Keep it so reviewers see there's no in-app purchase of digital goods.

## Keywords (iOS, ≤100 chars, comma-separated)

```
catalogo,tienda online,pedidos,ventas,negocio,ecommerce,productos,clientes,crm,whatsapp
```

## App Privacy (iOS) / Data Safety (Play) — data collected

The app collects data to operate the merchant account. Declare:

| Data type | Collected | Linked to user | Used for tracking | Purpose |
| --- | --- | --- | --- | --- |
| Email address | Yes | Yes | No | Account / authentication |
| Name | Yes | Yes | No | Account, app functionality |
| Customer contact info (their clients) | Yes | Yes | No | App functionality (CRM/orders) |
| Photos (product images) | Yes | Yes | No | App functionality |
| Push token / Device IDs | Yes | Yes | No | Order/CRM notifications |
| Usage/diagnostics | Optional | — | No | Only if analytics enabled |

- **Tracking (ATT):** No. The app does **not** track users across other apps/companies →
  no `NSUserTrackingUsageDescription` / ATT prompt needed.
- **Data encrypted in transit:** Yes (HTTPS/Supabase).
- **Data deletion:** users can request account deletion via nicolas@catalogohoy.com
  (Play requires a deletion path; add a self-serve delete if possible).

## Screenshots (per store)

Needed sizes:
- **iOS:** 6.9" (iPhone 17 Pro Max, 1320×2868) and 6.5"/6.7" — a single 6.9" set usually
  covers modern iPhones. 3–10 images.
- **Android:** phone screenshots (min 2, up to 8), 16:9 or 9:16, ≥1080px on the short side.
  Plus a **512×512 icon** and a **1024×500 feature graphic**.

Suggested screens (capture from a seeded tenant): Inicio (KPIs + chart) · Productos ·
Órdenes · Cliente/CRM · Editar catálogo. Capture recipe (iOS sim):
`xcrun simctl io <UDID> screenshot out.png`. Interactive navigation needs manual taps
(synthetic taps don't reach the WKWebView on the simulator).

## Remaining manual steps

### iOS
1. ✅ Apple Developer account **ACTIVO** (aprobado 2026-09-28; cert "Apple Development:
   NICOLAS ALEJANDRO SOTO OSORIO" ya en el keychain).
2. ✅ `DEVELOPMENT_TEAM = G2K6QW9VZ2` seteado en el pbxproj (Debug+Release), automatic signing.
   La capability **Push Notifications** ya está pre-cableada (`App/App.entitlements` +
   `CODE_SIGN_ENTITLEMENTS`).
3. ⏳ Create an **APNs Auth Key (.p8)** → https://developer.apple.com/account/resources/authkeys/list
   → upload en Firebase: https://console.firebase.google.com/project/catalogohoy-app/settings/cloudmessaging
4. ⏳ App Store Connect: crear el app record (`com.catalogohoy.app`) → https://appstoreconnect.apple.com/apps
   y llenar esta metadata + App Privacy + screenshots.
5. ⏳ Xcode → Product → Archive → distribute a TestFlight / App Store.

### Android (repo build-ready; falta solo la cuenta)
1. ✅ **Firebase Android app** registrada; `android/app/google-services.json` presente (gitignored).
2. ⏳ **Play Console** ($25): crear cuenta+app → https://play.google.com/console — metadata,
   Data Safety form, content rating.
3. ✅ El artefacto compila firmado (verificado 2026-09-28, JDK 21 instalado):
   ```bash
   export JAVA_HOME=/opt/homebrew/opt/openjdk@21   # Capacitor 8 requires JDK 21 (not 17)
   export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
   npm run mobile:build            # nx build + cap sync
   cd android && ./gradlew :app:bundleRelease
   # → android/app/build/outputs/bundle/release/app-release.aab
   ```
4. Upload the AAB. Enroll in **Play App Signing** (recommended); this upload keystore becomes
   your *upload key*.

## Signing — upload keystore (Android)

- File: `android/catalogohoy-upload.keystore` (**gitignored — NOT in the repo**).
- Config: `android/keystore.properties` (**gitignored**) holds the passwords; `build.gradle`
  reads them for the `release` signingConfig (absent file ⇒ unsigned release, still compiles).
- Alias: `catalogohoy`.
- **SHA-1:** `E6:4B:AC:01:6B:DD:CF:16:26:1A:DC:42:FF:18:33:CB:60:60:5C:57`
- **SHA-256:** `2E:B7:52:54:61:B1:C0:61:85:86:27:86:DC:67:38:E6:10:DB:D7:63:30:20:A0:28:2E:3E:E0:F6:75:45:A2:7F`
- 🔴 **BACK UP the keystore file + its password somewhere safe.** Losing them means you can
  never publish an update to the same Play listing.
