# Gotchas (trampas conocidas)

> Lo que te hace perder tiempo si no lo sabés. Agregá acá cada nueva trampa.

## "Failed to fetch dynamically imported module" (chunk viejo tras deploy)

- SPA con lazy-loading (`loadChildren`/`import()`): si el usuario tiene la app abierta durante
  un **deploy**, su `index.html` viejo referencia `chunk-XXXX.js` que el deploy nuevo ya
  reemplazó → el import dinámico falla con `TypeError: Failed to fetch dynamically imported
  module`. **No es un bug de la app**, es inherente a deployar un SPA.
- Variantes por navegador (todas las cubre `isChunkLoadError`): Chrome/Firefox "Failed to
  fetch dynamically imported module"; **Safari/iOS "'text/html' is not a valid JavaScript MIME
  type" / "Importing a module script failed"** (el host devuelve el index.html en vez del .js).
- Mitigación en código: `ChunkAwareErrorHandler` (en `core/providers/sentry/sentry.ts`)
  detecta el error de chunk y **recarga la página una vez** (guard anti-loop por
  `sessionStorage`) para traer la versión nueva; el resto de errores van a Sentry normal.
- Prevención a nivel plataforma: **Vercel Skew Protection** (mantiene los assets de deploys
  viejos disponibles para clientes con la versión anterior) — evita que el error ocurra.

## Ruido de terceros en Sentry (`ignoreErrors`)

- Errores que NO son de la app y se descartan en `Sentry.init.ignoreErrors`
  (`core/providers/sentry/sentry.ts`): navegadores in-app (Instagram/FB/TikTok WebView) →
  `"Java object is gone"` / `"Error invoking postMessage"` (stack con `iabjs://…`); y el ruido
  benigno de `ResizeObserver loop…`. Agregá ahí nuevos patrones de ruido de terceros.

## Sentry `tracePropagationTargets` rompe las Edge Functions (CORS)

- El **browser tracing** de Sentry adjunta headers `sentry-trace` y `baggage` a
  cada request cuyo URL matchee `tracePropagationTargets`. Las **Edge Functions
  de Supabase** tienen un `Access-Control-Allow-Headers` **fijo** en el código
  (`authorization, x-client-info, apikey, content-type`) que **no** incluye esos
  headers → el browser **bloquea el POST en el preflight** (se ve `OPTIONS 200`
  en los logs pero **nunca un POST**) y el cliente recibe *"Failed to send a
  request to the Edge Function"* (`FunctionsFetchError`, un `fetch` rechazado).
- Sucede para **todas** las funciones llamadas desde el browser (checkout/pagos,
  IA, créditos…), en todos los países. Síntoma en DevTools: la request a la
  función en rojo, "No data found for resource", y no llega nada al backend.
- **Regla**: NO poner el dominio de Supabase (ni terceros con CORS estricto) en
  `tracePropagationTargets`. Está en `[]` (no propagar a nada). El backend no
  continúa la traza igual, así que no se pierde nada útil.
- Si en el futuro hiciera falta propagar, primero agregá `sentry-trace, baggage`
  al `Access-Control-Allow-Headers` de **todas** las edge functions invocadas
  desde el browser.

## `environment.production` es SIEMPRE false — usar `isDevMode()`

- El barrel `@catalogohoy/env` (`libs/catalogohoy/environments/src/index.ts`) hace
  `export * from './environment.development'` (production:false). El `fileReplacements` de la
  config `development` reemplaza `environment.ts` → `environment.development.ts`, pero el barrel
  **no importa `environment.ts`**, así que el reemplazo no aplica y **`environment.production`
  queda en false en TODOS los builds** (`environment.ts` con production:true es código muerto).
- Para detectar producción usá **`isDevMode()`** (false en builds prod), como ya hacen PostHog,
  MetaPixel, Supabase y los guards. No te fíes de `environment.production`.
- Esto tuvo a Sentry sin inicializar en prod (el DSN estaba en el bundle pero `init()` salía
  por el guard `!environment.production`). Fix: guard con `isDevMode()`.

## Deploy / ramas

- **Cada app deploya de una rama distinta** (`main` / `authentication` / `landing`). Un
  cambio cross-app va a varias ramas. Ver `deployment.md`.
- **Landing = Tailwind v3; resto del monorepo = Tailwind v4.** Mergear `main` a `landing`
  rompe el build (PostCSS: "tailwindcss as a PostCSS plugin... moved to @tailwindcss/postcss").
  → No mergear main entero a landing; aplicar solo el cambio puntual.
- La **landing SÍ buildea localmente desde 2026-07-09** (la dep git privada `falso` fue
  eliminada de sus package.json). Receta: dentro de `apps/landing`,
  `npm install --workspaces=false` (sin el flag, npm la trata como workspace del monorepo
  y el hoisting a la raíz rompe la resolución de plugins de Tailwind v3) y buildear con
  `./node_modules/.bin/vite build` (no `npm run build`). Un build fallido en Vercel
  igual no tumba el prod actual.

## SEO / sitemaps / robots (2026-07-13)

- **robots.txt y sitemap.xml del storefront son funciones Vercel** (`api/robots.ts`,
  `api/sitemap.ts`) vía rewrites del `vercel.json` raíz. **NO crear** `robots.txt` /
  `sitemap.xml` estáticos en `apps/catalogohoy/public/` — en Vercel el filesystem le gana
  al rewrite y apagaría la versión dinámica sin error visible.
- **El sitemap del help se autogenera en build** (`apps/help/scripts/gen-sitemap.mjs`
  escanea el `dist/` del SSG). No editar `public/sitemap.xml` a mano (el residuo viejo que
  apuntaba a `catalogohoy.com` se borró el 2026-07-13; el build lo pisaba igual).
- **El sitemap/robots de la landing viven en la rama `landing`** — la copia de
  `apps/landing/` en `main` está desactualizada (rutas viejas). Editar siempre sobre la rama.
- **Googlebot no ve la SPA del storefront**: `middleware.ts` intercepta crawlers (regex
  incluye Googlebot/bingbot) y sirve HTML estático por tenant. Desde 2026-07-13 va
  enriquecido (lista de productos + JSON-LD Store/ItemList/Product) — si se agrega un campo
  del catálogo que deba indexarse, hay que sumarlo ahí, no solo a la SPA. Los crawlers
  sociales solo leen los meta OG, así que el cuerpo extra no cambia los previews de WhatsApp.

## Nx + worktrees

- Servir/buildear desde un worktree **sin su `node_modules`** + `NX_WORKSPACE_ROOT_PATH`
  apuntando mal → Nx compila el **repo principal**, no el worktree. Fix: `npm install` en el
  worktree (o symlink node_modules) **y** prefijar el comando con `NX_WORKSPACE_ROOT_PATH="$(pwd)"`.
- Cambios en `app.routes.ts` a veces **no los toma el HMR** (la tabla de rutas queda en
  caché). Si una ruta nueva no matchea, reiniciar el `nx serve`.

## Ruteo multi-tenant (capturas headless / Playwright)

- Las rutas de **admin necesitan sesión**. Un navegador headless sin sesión termina
  **redirigido al catálogo de un tenant** (`/catalogo`), no a tu ruta.
- `path: ''` (storefront) matchea como prefijo y puede tragarse rutas no registradas →
  una ruta de "preview" temporal hay que ponerla **antes** de `path: ''`… pero aun así el
  ruteo multi-tenant puede redirigir. **Capturar vistas admin headless es frágil.**
- Para capturar el admin con Playwright **necesitás inyectar la sesión Supabase**: obtener
  `access_token`/`refresh_token` (del localStorage del navegador del usuario, o minteando un
  magic link con la service key — que el sandbox bloquea por seguridad) y setearlos en
  localStorage antes de navegar. Modales aislados (sin auth, vía ruta temporal sin guard) sí
  se capturan bien (así se hizo el screenshot del modal "Generar imagen con IA").

## Iconos (lucide / ui-icon)

- `ui-icon name="..."` usa **kebab-case** (`loader-circle`, `wand-sparkles`, `sparkles`,
  `plus`, `eraser`, `bot`, `x`, `minus`). El icono debe estar **registrado** en
  `libs/catalogohoy/core/.../providers/icons/providers/lucide.provide.ts` (import + pick).
  Si no está registrado, se ve en blanco. **Aplica también a `ui-button [icon]`** (renderiza
  vía `ui-icon` → lucide, no PrimeIcons). Íconos custom de marca (sufijo `$`: `facebook$`,
  `whatsapp$`…) viven en `custom.provide.ts` del mismo dir como SVG inline.

## Estilos

- **Siempre `rem`, nunca pixeles hardcodeados** (los tokens de Tailwind son rem; en
  `ui-icon` usar `styleClass="w-4 h-4"`). Para valores finos, arbitrary values en rem:
  `text-[0.6875rem]`, `min-h-[11rem]`.
- Skinear PrimeNG: clases internas v20 son `.p-select`, `.p-select-label`, `.p-placeholder`,
  `.p-select-dropdown`, `.p-dialog`, etc. Skinear con `::ng-deep` + un `styleClass` propio.
- `ui-dialog` toma `headerTitle` como **texto plano** (no admite icono en el header) → si
  querés un icono en el título, usá emoji (p. ej. 🪄).

## ui-select

- No expone `routerLink` (es CVA). Para navegar al elegir, usar `(ngModelChange)` + un método
  con `Router.navigate`. El `[filter]="true"` activa el buscador (filtra por `optionLabel`).
- Para usarlo fuera de un form: `[ngModel]` + `[ngModelOptions]="{ standalone: true }"`.
- No tiene input `disabled` que funcione vía binding simple → deshabilitar con un wrapper
  `pointer-events-none` (no usar `opacity-50` si querés conservar el color del texto).

## Toasts (`SonnerToasterService`)

- `wait()` usa `toast.loading()` con **`duration: Infinity`** (si no, sonner lo auto-cierra a
  ~4s aunque la acción siga). `success/error/warning/info` llaman `dismissWait()` primero.
  Patrón: `wait('…')` → en éxito `success('…')`, en error `error(...)` (ambos cierran el wait).

## PrimeNG dialog vs overlay custom

- Para que se vea "nativo" como el resto, usar `ui-dialog` (envuelve `p-dialog`), no un
  overlay `fixed inset-0` propio. Se abre con `show()` (viewChild) en `ngAfterViewInit`
  cuando el padre lo monta con `@if`. `closable`/`dismissableMask`/`closeOnEscape` =
  `!processing()` para no cerrar mientras procesa.

## Moneda del catálogo público

- Hay **dos** símbolos de moneda en la respuesta de `get_public_catalog`:
  `config.currency_symbol` (de `tenant_ecommerce_config`, **suele estar stale en `'$'`**)
  y `currency_config.currency_symbol` (de `tenant_currency_config`, el que el tenant
  realmente elige en "Tasas del día" → **autoritativo**: Q, S/, R$, €, RD$…).
- `CatalogInfo.currencySymbol` (en `ecommerce.service.ts`) tiene **dos ramas**:
  - **Venezuela (`country_code === 'VE'`)** → caso especial: el precio base mostrado es la
    moneda de **referencia** (`$`/`€`), NO la local (Bs.). El Bs. se muestra aparte con el
    toggle `showLocalCurrencyPrice`. En VE `currency_config.currency_symbol` suele ser `'Bs.'`,
    así que **NO** se usa; se mantiene la lógica histórica `config.currency_symbol` → país →
    `'$'`. (Bug real: usar `cc` en VE hizo que un catálogo con config `'$'` y cc `'Bs.'`
    —`dicenorepostero`— mostrara `'Bs.'` siempre aunque el Bs. estuviera apagado.)
  - **Resto de países** → `currency_config.currency_symbol` es la fuente autoritativa
    (`Q`/`R$`/`RD$`/`S/`/`€`…) → país → `config.currency_symbol` → `'$'`. Usar `config` primero
    hacía que GT/BR/DO… mostraran `'$'` aunque la moneda fuera GTQ/BRL/DOP.
- **Separadores de miles/decimales**: los precios del storefront se formatean con el pipe
  `tenantPrice` (`e-commerce/.../presenter/pipes/tenant-price.pipe.ts`), que lee
  `EcommerceStore.numberFormat()` (de `currency_config.decimal_separator` /
  `thousand_separator`). Así un precio sale `1.234,50` (VE/AR) o `1,234.50` (GT/MX/US). Agrupa
  miles siempre; muestra 2 decimales solo si hay fracción (no llena de `,00`). **NO** antepone
  el símbolo (ese va aparte con `currencySymbol`). Las líneas de **Bs.** (VE) siguen con
  `| number:'1.2-2'` (es-locale ya coincide con la convención venezolana).

## Supabase / datos

- `users.id` (bigint) = owner; `users.auth_user_id` (uuid) = `auth.uid()`.
- **No existe** tabla `stripe_events`; la idempotencia de packs de crédito es por
  `ai_credit_purchases.stripe_session_id`.
- Edge functions: para deployar payloads grandes vía MCP sin errores de escape, generar el
  JSON con `python3 -c "import json; print(json.dumps(open(...).read()))"` y leerlo.
- **WhatsApp cachea los previews de links por dispositivo/chat durante días**: tras cambiar
  los OG tags (middleware.ts), el preview viejo persiste donde ya se compartió el link.
  Para revalidar: compartir con un sufijo (`?v=2`) o en un chat nuevo. Si "funciona en
  iPhone pero no en Android", casi siempre es este caché, no el servidor.
- **PostgREST no da error en UPDATE que matchea 0 filas** → "éxito" silencioso. Mordió el
  2026-07-09: cuentas nuevas sin fila en `tenant_ecommerce_config` "guardaban" la config
  sin persistir nada. Fix: trigger `trg_seed_ecommerce_config` siembra la fila al crear el
  tenant (+ backfill). Patrón a evitar: `.update().eq()` asumiendo que la fila existe.
- **Dirty-checks: comparar lo NORMALIZADO, no el draft crudo**: si un campo se transforma
  al guardar (ej. descripción pasa por `sanitizeRichText`, que colapsa los nbsp de Quill),
  el dirty-check debe comparar `transform(draft) !== guardado` — comparar el draft crudo
  deja el banner "cambios sin guardar" encendido para siempre tras guardar (bug 2026-07-09,
  reproducido y verificado con Playwright E2E contra prod con sesión inyectada).

## Verificar el storefront local contra cualquier tenant de prod

- El storefront público **no necesita sesión** y el dev server usa el Supabase de prod, así
  que se puede verificar un fix con los datos reales de cualquier cliente.
- En dev el slug **no** sale del path de forma confiable (la app redirige a `/` y usa
  `DEV_TENANT_SLUG`): cambiar temporalmente `DEV_TENANT_SLUG` en
  `libs/catalogohoy/core/src/constants/tenant.constant.ts` al slug del tenant (el propio
  archivo lo documenta) y **revertirlo antes de commitear**.
- El catálogo **carga productos de forma perezosa**: con Playwright hay que scrollear
  (`page.mouse.wheel`) hasta que la card objetivo entre al DOM antes de asertar sobre ella.
