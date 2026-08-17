# 🧠 BRAIN — Cerebro central de CatalogoHoy

> **Esto es la fuente de verdad del proyecto.** Antes de responder, planificar o
> tocar código, **leé primero acá** (y el doc específico que corresponda). Si algo
> que aprendés contradice este cerebro, actualizá el doc — no lo dejes desactualizado.

CatalogoHoy es un SaaS multi-tenant para crear **catálogos digitales** (tipo
e-commerce liviano) orientado a tiendas hispanohablantes (foco Venezuela + LatAm +
España). Cada usuario (owner) puede tener varios catálogos (tenants); cada catálogo
tiene productos, órdenes, clientes, analíticas, reportes, equipo y un storefront
público. Monetiza con planes (Stripe) + créditos de IA.

## Cómo usar este cerebro

1. **Empezá por este índice** y abrí el doc del área que vas a tocar.
2. Para cambios de **base de datos** → `database.md` (schema, RPCs, triggers).
3. Para **patrones de código** (Either, Signal Store, componentes, i18n) → `patterns.md`.
4. Para **subir a prod** → `deployment.md` (¡ramas distintas por app!).
5. Antes de pelear con algo raro → `gotchas.md` (trampas conocidas).

## Mapa de documentos

| Doc | Qué contiene |
|---|---|
| **`architecture.md`** | Monorepo Nx, capas (domain/infra/presenter), apps, stack, multi-tenancy, routing/guards, shared + ui. |
| **`deployment.md`** | Ramas de deploy (main / authentication / landing), cómo deploya cada app, Tailwind v3 vs v4, secrets/env. |
| **`gotchas.md`** | Trampas: worktree+Nx, Tailwind v3/v4, captura headless con sesión, ruteo multi-tenant, etc. |
| **`business-rules.md`** | Planes y límites, asignación de créditos de IA, precios, packs, descuentos por volumen, reportes semanales. |
| **`integrations.md`** | Edge functions (todas) + servicios externos (Stripe, Supabase, fal.ai, Anthropic, PostHog, Meta, WhatsApp, Discord, Resend, **Google**: Workspace/OAuth/Search Console/GA4 + sitemaps por app). |
| **`features/commerce.md`** | e-commerce (catálogo público + checkout), product, order, category, client. |
| **`features/account-billing.md`** | plan, payments, profile, tenant, teams, ecommerce-config. |
| **`features/supporting.md`** | rate (tasas BCV), reports, analytics, home, core, environments. |
| **`features/ai-credits.md`** | Sistema de créditos de IA + features de IA (generar/quitar fondo/borrador/mejorar texto). |
| **`features/auth-verification.md`** | Auth (login/signup/Google), verificación de correo, flujo cross-app. |
| **`database.md`** *(existente)* | Schema completo, RPCs, triggers, queries reales. |
| **`patterns.md`** *(existente)* | Either monad, Signal Store, componentes standalone, routing, i18n. |

## Stack (resumen)

Angular ~20 standalone · @ngrx/signals (Signal Store) · PrimeNG ^20 + TailwindCSS v4
(la **landing** usa Tailwind v3, ver gotchas) · Supabase (Postgres + Auth + Storage +
Edge Functions Deno) · Transloco (es/en, default es) · Lucide icons (kebab-case) ·
Ramda + @sweet-monads/either · Jest + Playwright.

## Apps (5)

| App | Puerto local | Deploy desde rama | Rol |
|---|---|---|---|
| **catalogohoy** | 4200 | `main` | Panel admin + storefront público |
| **authentication** | 5200 | `authentication` | Login / signup / verificación (`auth.catalogohoy.com`) |
| **landing** | — | `landing` | Sitio de marketing (React/Vite, Tailwind v3) |
| **help** | — | — | Centro de ayuda (React/Vite) |
| **internal** | — | — | Herramientas internas (impersonar, cupones) |

## Protocolo de mantenimiento (importante)

Este cerebro **solo sirve si se mantiene**. Reglas:
- Cuando implementes algo nuevo, cambies una regla de negocio, descubras una trampa,
  o cambies el deploy/infra → **actualizá el doc correspondiente en el mismo cambio**.
- Convertí fechas relativas a absolutas. Sé conciso y concreto.
- Si un doc crece mucho, dividilo; mantené este índice al día.
- Lo que ya está en el código o en git NO va acá (no documentes estructura obvia);
  documentá lo **no evidente**: por qué, reglas de negocio, gotchas, decisiones.

## Acceso desde otro repo / otra app

Hoy la fuente de verdad vive **en este repo** (`.claude/docs/`), versionada en git.
Para consultarla desde otro repo o app:
- **Submódulo git** o copia sincronizada de `.claude/docs/` en el otro repo.
- **A futuro (recomendado para acceso cross-tool):** exponer este cerebro vía un
  **MCP server de conocimiento** (p. ej. un memory/knowledge MCP) que cualquier
  cliente Claude pueda consultar. Requiere hostearlo/conectarlo (pendiente de definir).
- Mi **memoria personal de Claude** (`~/.claude/.../memory/`) tiene un puntero a este
  cerebro y se auto-carga en cada sesión, pero es privada de mis sesiones (no del equipo).
