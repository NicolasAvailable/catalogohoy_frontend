# Arquitectura

> Ver `BRAIN.md` para el índice. Acá: cómo está armado el monorepo y los patrones.

## Monorepo Nx

```
apps/        catalogohoy (admin+storefront) · authentication · landing · help · internal
libs/
  catalogohoy/<feature>/   ← cada feature en 3 capas
  shared/{domain,application,infrastructure,presenter}
  ui/                      ← @ui: componentes compartidos (PrimeNG v20 + Tailwind)
```

Aliases (siempre usarlos, nunca rutas relativas cruzando libs):
`@catalogohoy/*` · `@shared/*` · `@ui` · `@catalogohoy/env`.

## Patrón de 3 capas (cada feature lib)

```
feature/
├── domain/          Interfaces, models (clases inmutables tipo Entity), contratos abstractos Base*Service
├── infrastructure/  Servicios Supabase concretos + NgRx Signal Stores + mappers
└── presenter/       Componentes standalone, views, rutas lazy (Route[] exportado)
```

- **Domain** define `abstract class Base*Service`. **Infrastructure** lo implementa.
  Inyectás el concreto; dependés del abstracto para tipos.
- **Stores**: `signalStore({ providedIn: 'root' }, withState, withComputed, withMethods)`.
  Mutar **solo** con `patchState`. Singletons.
- **Servicios** `@Injectable({ providedIn: 'root' })`.

## Manejo de errores (clave)

Los servicios devuelven `Promise<E.Either<Error, T>>` (`@sweet-monads/either`).
Nunca tiran excepción: mapean el `error` de Supabase a `E.left(new Error(error.message))`.
Se consumen con `.mapRight()` / `.mapLeft()`. En componentes, los errores se muestran
con `ToastService` (que envuelve a `Exception`).

## Componentes

Todos **standalone**. `inject()`, `input()`/`output()` basados en signals, `@if`/`@for`,
i18n con el pipe `transloco` / `TranslateService.instant()`. `BaseComponent` (en
`@shared/presenter`) da helpers (`useCaseProgress`, `destroyRef`, etc.).

## Multi-tenancy (transversal)

- Un **owner** (`users.id`, bigint) mapeado desde `auth.users` (`auth_user_id`, uuid).
- Un owner puede tener varios **tenants** (catálogos). Relación en `users_tenants`
  (`user_id`, `tenant_id`, `role` ∈ owner/admin/member, `is_default`).
- El **slug** del tenant se saca de la URL (subdominio `slug.catalogohoy.com` o
  `custom_domain`), NO de localStorage, y se persiste en localStorage para UX.
- **TODAS** las queries filtran por `tenant_id`. `TenantStore` resuelve el tenant con
  prioridad: slug del subdominio actual > `is_default` > primero. Tiene un singleton
  `loadingPromise` para evitar llamadas duplicadas; resetear en logout.

## Routing y guards

- Rutas lazy `loadChildren()` → arrays `Route[]` exportados por cada feature.
- Guards: `authenticationGuard`, `isValidSlugGuard` (valida el slug, reintenta 3x para
  no dar falso "not-found" por error transitorio), `hasAccessGuard` / `teamPermissionGuard`
  (permisos de equipo). Resolver: `profileResolver`.
- `app.routes.ts` (catalogohoy): `''` = storefront público (e-commerce, con
  `isValidSlugGuard`), `admin` = panel (auth + slug + permisos), más `catalog-unavailable`,
  `public/report`, `no-access`, `**→''`. **Ojo:** `path: ''` matchea como prefijo y puede
  tragarse rutas no registradas (ver gotchas).

## Shared (`libs/shared/*`)

- **domain**: `Either`/`EitherBuilder`, `Entity`/`EntityList`, `Specification`, `Exception`,
  `Multimedia`, helpers `is.*` / `has` / `when`.
- **application**: `BaseUseCase`, `UseCaseProgress`/`ProgressBuilder`.
- **infrastructure**: `ToastService` (envuelve `SonnerToasterService`), `LocationService`
  (geo), `HtmlSanitizerService` (DOMPurify), `UploaderService` (subida con chunks/progress).
- **presenter**: `BaseComponent`, validators (`whiteSpacesValidator`, `confirmPasswordValidator`,
  `dateRangeValidator`, `richTextMaxLengthValidator`), pipes (`TranslatePipe`, `StripHtmlPipe`,
  `SafeDescriptionHtmlPipe`, etc.), directivas.

## UI (`@ui`)

~36 componentes base (PrimeNG v20 re-estilizados + Tailwind v4): button, dialog (+confirm),
select (con `[filter]` opcional), multi-select, input(s), table, menu, card, tabs, accordion,
stepper, image, product-media, icon, avatar, badge, chip, toggle, checkbox, datepicker,
color-picker, counter, qr, etc. + dominio `uploader` (drop-uploader).
**Iconos:** `ui-icon name="kebab-case"` (lucide). Registrados en
`libs/catalogohoy/core/.../lucide.provide.ts` (hay que registrar el icono ahí para usarlo).

## Core (`@catalogohoy/core`)

`SupabaseClientProvider` (singleton; un segundo cliente causa contención de lock de auth) ·
`MetaPixelService` (solo prod) · provee iconos lucide + custom · PrimeNG (tema Lara, paleta
light/dark) · Transloco. `app.config.ts` arma todo en bootstrap; `AppComponent` crea el
cliente Supabase y captura query params a localStorage.
