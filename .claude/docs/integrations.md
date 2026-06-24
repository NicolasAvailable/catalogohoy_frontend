# Edge Functions e Integraciones

> Edge functions Deno en `supabase/functions/`. Algunas están deployadas pero **no en el
> repo** (ver nota al final). Detalle del sistema de IA en `features/ai-credits.md`.

## Edge functions (en el repo)

| Función | Qué hace | Trigger | verify_jwt | Externos / secrets |
|---|---|---|---|---|
| **fal-ai-images** | Quitar fondo (BiRefNet), segmentar (SAM-2), generar (FLUX schnell). Gateada por créditos (1/1/3). Persiste a Storage. Genera con texto en español. | front invoke | sí | fal.ai · `FAL_KEY` |
| **improve-text** | Mejora/alarga/acorta descripción (Claude Haiku). Gateada (1). Anti prompt-injection. | front invoke | sí | Anthropic · `ANTHROPIC_API_KEY` |
| **get-credits** | Saldo de créditos del owner (mensual+comprado); `ensure_ai_credits` primero. | front invoke | sí | `SERVICE_ROLE` |
| **create-credit-checkout** | Stripe Checkout de créditos (cantidad libre, precio server-side con descuento por volumen). | front invoke | sí | Stripe · `STRIPE_SECRET_KEY` |
| **confirm-credit-purchase** | Confirma compra de créditos al volver de Stripe (idempotente por session_id) → `add_purchased_credits`. | front invoke | sí | Stripe · `STRIPE_SECRET_KEY` |
| **ai-excel-mapper** | Mapea columnas de Excel a campos de producto con Claude (sonnet). | front invoke | sí | Anthropic |
| **manage-stripe-coupons** | Admin interno: cupones + promotion codes de Stripe. | app internal | sí + `_assert_internal_admin()` | Stripe |
| **impersonate-tenant** | Admin interno (whitelist): magic link para impersonar owner. | app internal | sí + whitelist email | `SERVICE_ROLE` |
| **delete-account** | Borra la cuenta del usuario (users, ownerships si es único owner, users_tenants, auth.users). | front invoke | sí | `SERVICE_ROLE` |
| **posthog-analytics** | Query a PostHog (HogQL) para el dashboard de analíticas por `tenant_slug`. | front invoke | sí | PostHog · `POSTHOG_PERSONAL_KEY` |
| **countries-proxy** | Proxy + cache 24h de countriesnow.space (estados/ciudades). | front invoke | no | countriesnow.space |
| **notify-checkout-intent** | Discord embed cuando el user inicia checkout de plan. | front invoke | sí | Discord · `DISCORD_CHECKOUT_INTENT_WEBHOOK` |
| **send-whatsapp-notification** | Templates de WhatsApp (order_received, order_completed, plan_expiring, payment_failed) vía Meta Cloud API. Auth server-to-server por `x-webhook-secret`. Loguea a `whatsapp_notification_logs`. | cron/server | no (webhook-secret) | Meta · `WHATSAPP_*` |
| **send-whatsapp-test** | Test de WhatsApp desde el front (template hardcodeado). | front invoke | sí | Meta · `WHATSAPP_*` |
| **stripe-webhook** | Webhook de Stripe (firma verificada): checkout completado (alta/upgrade), subscription updated/deleted, invoice succeeded/failed (retries + emails). Aplica rewards de referidos, manda Discord + Resend. **Crítico — no editar a ciegas.** | webhook Stripe | no (firma) | Stripe · Resend · Discord · `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `DISCORD_PAYMENTS_WEBHOOK_URL` |

## Edge functions deployadas pero NO en el repo

`send-weekly-report` (cron domingos), `new-lead-discord` (notificación de lead nuevo),
`send-order-notification`. El `stripe-webhook` en prod puede diferir del repo. **No las
edites a ciegas**; el repo puede estar atrás de prod.

## Triggers / RPCs de negocio (en prod, ver `database.md`)

- **Créditos**: `ensure_ai_credits`, `spend_ai_credits` (atómica, FOR UPDATE, devuelve -1 si
  no alcanza), `refund_ai_credits`, `add_purchased_credits`, `reset_due_ai_credits` (cron
  diario), `sync_ai_credits_on_plan_change` (trigger en `tenants` AFTER UPDATE OF plan_id →
  acredita al subir de plan; defensivo, nunca bloquea el cambio de plan).
- **Anuncios por usuario autenticado**: tabla `user_announcement_views(auth_user_id,
  announcement_key)` + `has_seen_announcement` / `mark_announcement_seen` (SECURITY DEFINER,
  keyean por `auth.uid()`). El modal de IA en Home usa la clave `ai_v1`. **Antes** se guardaba
  en `users.seen_announcements text[]`, pero eso dejaba fuera a los miembros de equipo (no
  tienen fila en `public.users`) → el modal les reaparecía siempre. La migración
  `announcement_views_by_auth_uid` backfilleó los vistos previos.
- **Discord lead on verify**: `notify_new_lead` (trigger en `users_tenants`, solo si el correo
  ya está confirmado) + `notify_lead_on_email_confirm` (trigger en `auth.users` AFTER UPDATE
  OF email_confirmed_at). Así notifica una sola vez, en el momento correcto según el toggle.

## Integraciones externas (dónde se configuran)

| Servicio | Para qué | Dónde |
|---|---|---|
| **Supabase** | Postgres + Auth + Storage + Edge Functions | `core/providers/supabase` · proyecto `yvkurjivijnhliofmfmj` |
| **Stripe** | Planes/suscripciones, packs de crédito, cupones | edge functions de Stripe + public key en env |
| **Anthropic (Claude)** | Mejorar texto (Haiku 4.5) + mapear Excel (Sonnet) | edge functions · `ANTHROPIC_API_KEY` |
| **fal.ai** | Generar/quitar fondo/segmentar imágenes | `fal-ai-images` · `FAL_KEY` |
| **PostHog** | Analíticas (HogQL) | `core/providers/posthog` + `posthog-analytics` |
| **Meta Pixel** | Tracking (solo prod) | `core/providers/meta-pixel` |
| **Sentry** | Errores + performance (tracing) + session replay | `core/providers/sentry` (`initSentry`/`provideSentry`) · DSN en `env/sentry`. MCP en `.mcp.json`. |
| **WhatsApp (Meta Cloud API)** | Notificaciones de órdenes/plan | `send-whatsapp-*` · `WHATSAPP_*` |
| **Discord** | Webhooks de eventos internos (leads, checkout, pagos) | `notify-checkout-intent`, `stripe-webhook`, `new-lead-discord` |
| **Resend** | Email transaccional (recibos de pago, reportes semanales) | `stripe-webhook`, `send-weekly-report` |
| **countriesnow.space** | Estados/ciudades por país | `countries-proxy` |

## Sentry (errores + performance + replay)

- **Dos proyectos** (un DSN por app): `sentryDsnCatalogohoy` y `sentryDsnAuth` en
  `libs/catalogohoy/environments/src/sentry/sentry.ts`. Los DSN son **públicos** (van en el
  bundle, como la key de PostHog) — no son secretos.
- **Init**: `initSentry({ dsn, appName })` en cada `apps/*/src/main.ts` **antes** de
  `bootstrapApplication` (captura errores tempranos). **No corre en dev** ni si el DSN está vacío.
- **Providers**: `...provideSentry()` en cada `app.config.ts` → `ErrorHandler` de Sentry +
  `TraceService` (instrumenta el routing para performance). Vive en `core/providers/sentry`.
- **Muestreo**: `tracesSampleRate 0.1`, replay `0.1` sesiones / `1.0` con error
  (configurable en el env). Inputs enmascarados en el replay (`maskAllInputs: true`).
- **`tracePropagationTargets`**: dominios `*.catalogohoy.com` + el proyecto Supabase (para
  distributed tracing front↔backend).
- **MCP**: `sentry` (remoto, OAuth) en `.mcp.json` → `https://mcp.sentry.dev/mcp`.
- **Pendiente (opcional)**: subir **source maps** en el build de prod para stack traces legibles
  (necesita auth token + org/project slugs; `@sentry/cli` o el plugin de esbuild como postbuild).
