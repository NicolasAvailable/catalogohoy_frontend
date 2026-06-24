# Deployment

> Repo GitHub: `NicolasAvailable/catalogohoy_frontend`. Deploy por Vercel desde ramas.
> **Cada app deploya desde una rama distinta** — esto es lo más fácil de olvidar.

## Ramas de deploy (¡una por app!)

| Rama | Deploya | Notas |
|---|---|---|
| **`main`** | app **catalogohoy** (admin + storefront) | Acá va todo lo del panel y los libs `@catalogohoy/*` compartidos. |
| **`authentication`** | app **authentication** (`auth.catalogohoy.com`) | login/signup/verificación. **Divergida de main** (tiene commits propios) y suele estar atrás. |
| **`landing`** | app **landing** (marketing) | React/Vite, **Tailwind v3** (¡no v4!). Tiene commits propios. |

Un cambio que toca varias apps hay que llevarlo a **varias ramas**. Ejemplo real:
créditos de IA en planes → `main` (página de planes) **y** `landing` (Pricing.tsx).

### Sincronizar cambios a otra rama (patrón usado)

`main` suele estar adelante. Para llevar cambios sin romper:
- **`authentication`**: divergió pero comparte código → `git merge origin/main` suele ser
  **limpio** (git resuelve el rediseño de auth automáticamente). Hacerlo en un **worktree
  temporal** para no tocar el dir de trabajo, **buildear** (`nx build authentication`) y
  recién pushear `HEAD:authentication`.
- **`landing`**: ⚠️ **NO mergear `main` entero** — la landing usa **Tailwind v3** y main
  usa **v4**; el merge le mete v4 y rompe el build (PostCSS espera v3). En su lugar, aplicar
  **solo el cambio puntual** sobre la rama `landing` (worktree temporal, editar, commit, push).

### Worktree temporal para tocar otra rama (sin npm install si se puede)

```
git worktree add -f /tmp/x origin/<rama> && cd /tmp/x && git checkout -b tmp
# editar / merge
# para buildear: symlink node_modules del worktree principal:
ln -sfn /ruta/al/worktree/node_modules ./node_modules
NX_WORKSPACE_ROOT_PATH="/tmp/x" node_modules/.bin/nx build <app> --skip-nx-cache
git push origin HEAD:<rama>
cd - && git worktree remove /tmp/x --force && git branch -D tmp
```
> ⚠️ La **landing** NO buildea con el symlink (Tailwind v3 vs v4 del worktree principal).
> Para la landing, los cambios triviales se pushean sin build local (Vercel valida); si el
> deploy de Vercel falla, **no rompe el prod actual** (Vercel mantiene el último build bueno).

## Backend (Supabase) — ya está en prod aparte del frontend

- **Edge functions** y **migraciones** se aplican vía el MCP de Supabase (`deploy_edge_function`,
  `apply_migration`), independientes del deploy de Vercel. O sea: cuando "subís a prod" el
  frontend, el backend ya suele estar live.
- **Algunas edge functions están deployadas pero NO en el repo** (`send-weekly-report`,
  `new-lead-discord`, `send-order-notification`; `stripe-webhook` en prod puede diferir del
  repo). No las edites a ciegas: el repo puede estar atrás de prod.
- **Branches de Supabase no son viables**: las tablas base no están en migraciones del repo.
  Para validar SQL contra prod, usar `BEGIN … ROLLBACK` (dry-run), no branches.

## Build / verificación

- `nx build catalogohoy` / `nx build authentication` (prod). Antes de pushear a una rama
  de prod, **buildear** (salvo la landing, ver arriba).
- Serve local: `nx serve catalogohoy --port 4200` / `nx serve authentication --port 5200`.
- **Worktree + Nx**: si serveás/buildeás desde un worktree sin su propio `node_modules`,
  Nx puede compilar el repo PRINCIPAL. Fix: `npm install` en el worktree **o** symlink de
  node_modules + `NX_WORKSPACE_ROOT_PATH="$(pwd)"` en el comando. (Ver gotchas.)

## Env / secrets

- Frontend: `libs/catalogohoy/environments/src/...` (supabase url + **publishable** key,
  Stripe public key, PostHog public key, Meta Pixel id). Project Supabase:
  `yvkurjivijnhliofmfmj.supabase.co`.
- **Service role key / secrets** NO están en el frontend; viven en los secrets de las edge
  functions (Supabase). El sandbox bloquea escanear `.env` por la service key (es esperado).
- Secrets de edge functions (nombres): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `RESEND_API_KEY`, `FAL_KEY`, `ANTHROPIC_API_KEY`, `POSTHOG_PERSONAL_KEY`, `WHATSAPP_*`,
  `DISCORD_*`, `SUPABASE_SERVICE_ROLE_KEY`. Ver `integrations.md`.

## Supabase Auth — config de URLs

- **Site URL**: `https://auth.catalogohoy.com/`.
- **Redirect URLs** (allow-list) incluyen `https://auth.catalogohoy.com/*`,
  `https://*.catalogohoy.com/*`, `http://localhost:5200/**`, etc. Cubre `/confirm-email` y
  `/reset-password`. La navegación post-confirmación al admin es `window.location.href`
  (no un redirect de Supabase) → no necesita estar en la allow-list.
