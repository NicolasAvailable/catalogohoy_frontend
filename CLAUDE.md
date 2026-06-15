# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

Nx monorepo with two Angular applications and feature libraries organized by domain.

**Apps:** `catalogohoy` (port 4200) · `authentication` (port 5200)

**Library namespaces:**

- `@catalogohoy/*` — Feature libs: auth, profile, tenant, e-commerce, product, category, order, rate, home, ecommerce-config, core, environments, analytics, chat, client, plan, teams, whatsapp
- `@shared/*` — Cross-cutting: domain, application, infrastructure, presenter
- `@ui` — Shared UI components

## Commands

```bash
# Serve
npm run serve:catalogohoy
npm run serve:authentication

# Build
npm run build:catalogohoy
npm run build:authentication
npm run build                        # all

# Test & Lint
nx test <project>                    # single project
nx lint <project>
nx run-many --target=test --all
nx affected --target=test --base=main
```

## Architecture

Each feature lib under `libs/catalogohoy/` is split into three layers:

```text
feature/
├── domain/         # Interfaces, models, abstract service contracts (Base*Service)
├── infrastructure/ # Concrete Supabase services + NgRx Signal Stores
└── presenter/      # Standalone Angular components, views, lazy routes
```

`libs/shared/` mirrors this pattern for cross-feature concerns.

## Key Patterns

**State** — `signalStore` with `withState` + `withComputed` + `withMethods`. Mutate via `patchState` only. Stores are `providedIn: 'root'`.

**Error handling** — Services return `Promise<Either<Error, T>>` (`@sweet-monads/either`). Use `.mapRight()` / `.mapLeft()` chains. Never throw from service methods; map Supabase `error` to `E.left(new Error(error.message))`.

**Service contracts** — Domain layer defines the abstract class (`Base*Service`). Infrastructure implements it. Inject the concrete class; depend on the abstract for type safety.

**Components** — All standalone. Use `inject()`, signal-based `input()` / `output()`, and `@if` / `@for` control flow. i18n via `transloco` pipe.

**Routing** — Lazy `loadChildren()` pointing to exported `Route[]` arrays. Guards: `authenticationGuard`, `isValidSlugGuard`. Profile via `profileResolver`.

**Multi-tenancy** — Tenant slug from query params stored in `localStorage` by AppComponent. All Supabase queries filter by `slug`.

**Imports** — Always use path aliases (`@catalogohoy/*`, `@shared/*`, `@ui`). Never relative paths across library boundaries.

## Tech Stack

| Concern | Library |
| --- | --- |
| Framework | Angular ~20, standalone components |
| State | @ngrx/signals |
| UI | PrimeNG ^20, TailwindCSS v4 |
| Backend | Supabase (`@supabase/supabase-js`) |
| i18n | Transloco (en/es, default: es, `LOCALE_ID='es'`) |
| Icons | Lucide Angular |
| Functional | Ramda, @sweet-monads/either |
| Testing | Jest + jest-preset-angular, Playwright (E2E) |

## App Bootstrap

`app.config.ts`: PrimeNG (Lara theme, custom light/dark palette), Transloco, Supabase (via `SupabaseClientProvider.create()` in AppComponent), Lucide icons, shared UI providers.

## Custom Slash Commands

Available under `/project:*` — see `.claude/commands/` for full prompts:

| Command | Purpose |
| --- | --- |
| `/project:new-feature <name>` | Scaffold a complete feature library (domain/infra/presenter) |
| `/project:new-store <name>` | Generate an NgRx Signal Store |
| `/project:new-service <name>` | Generate abstract + concrete service pair |
| `/project:new-component <name>` | Generate a standalone view or dumb component |
| `/project:check [project]` | Run lint + tests on affected projects |
| `/project:review` | Code review against project architecture rules |

## Reference Docs

- [`.claude/docs/patterns.md`](.claude/docs/patterns.md) — Either monad, Signal Store, component, routing, and i18n code examples
- [`.claude/docs/database.md`](.claude/docs/database.md) — Full Supabase schema: all 11 tables with columns, types, relationships, and real query patterns extracted from the codebase
