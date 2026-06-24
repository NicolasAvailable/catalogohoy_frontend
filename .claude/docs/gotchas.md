# Gotchas (trampas conocidas)

> Lo que te hace perder tiempo si no lo sabés. Agregá acá cada nueva trampa.

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
- La **landing no buildea localmente** con el `npm install` del worktree (dep git privada
  falla la instalación). Cambios triviales se pushean y Vercel valida; un build fallido en
  Vercel no tumba el prod actual.

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
  Si no está registrado, se ve en blanco.

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
