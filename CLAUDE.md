# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🧠 READ FIRST: the project brain

**Before answering, planning, or touching code, read [`.claude/docs/BRAIN.md`](.claude/docs/BRAIN.md)** —
it's the central source of truth (architecture, features, business rules, deployment, gotchas,
integrations) and points to every other doc. When you learn something non-obvious or change a
rule/deploy/infra detail, **update the relevant doc in the same change** so the brain stays current.

## Monorepo Overview

Nx monorepo with two Angular applications and feature libraries organized by domain.

**Apps:** `catalogohoy` (port 4200) · `authentication` (port 5200) · `landing` (marketing site, catalogohoy.com)

> **Landing (catalogohoy.com):** el sitio de marketing vive en `apps/landing` (React/Vite + Tailwind v3, distinto al resto del monorepo que es Angular). Deploya desde la rama `landing`. Sección de precios: `apps/landing/src/components/landing/Pricing.tsx`.

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

## Reference Docs — the brain (`.claude/docs/`)

- [`BRAIN.md`](.claude/docs/BRAIN.md) — **start here**: index + project overview + maintenance protocol
- [`architecture.md`](.claude/docs/architecture.md) — monorepo, 3-layer pattern, multi-tenancy, routing, shared + ui
- [`deployment.md`](.claude/docs/deployment.md) — deploy branches (main / authentication / landing), Tailwind v3 vs v4, secrets
- [`gotchas.md`](.claude/docs/gotchas.md) — known traps (worktree+Nx, Tailwind v3/v4, headless capture, multi-tenant routing…)
- [`business-rules.md`](.claude/docs/business-rules.md) — plans/limits, AI credit allocations, pricing, weekly reports
- [`integrations.md`](.claude/docs/integrations.md) — all edge functions + third-party services
- [`features/`](.claude/docs/features/) — per-domain: commerce, account-billing, supporting, ai-credits, auth-verification
- [`patterns.md`](.claude/docs/patterns.md) — Either monad, Signal Store, component, routing, i18n code examples
- [`database.md`](.claude/docs/database.md) — full Supabase schema, RPCs, triggers, real query patterns
