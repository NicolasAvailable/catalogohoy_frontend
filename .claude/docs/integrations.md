# Edge Functions e Integraciones

> Edge functions Deno en `supabase/functions/`. Algunas están deployadas pero **no en el
> repo** (ver nota al final). Detalle del sistema de IA en `features/ai-credits.md`.

## Edge functions (en el repo)

| Función | Qué hace | Trigger | verify_jwt | Externos / secrets |
|---|---|---|---|---|
| **fal-ai-images** | Quitar fondo (BiRefNet), segmentar (SAM-2), generar + editar imagen (Gemini 2.5 Flash Image / "Nano Banana"). Gateada por créditos (1/1/5/5: quitar-fondo 1, segmentar 1, generar 5, editar 5). Persiste a Storage. `generate` acepta `aspectRatio` (auto/square/landscape/portrait → aspect_ratio de Gemini) y `style` (default/product/studio/lifestyle/minimal/threeD → descriptor del prompt); `edit` (img→img) toma `imageUrl` + instrucción en `prompt`. **No agrega texto a la imagen salvo que el prompt lo pida; si lo pide, va en español.** | front invoke | sí | fal.ai · `FAL_KEY` |
| **improve-text** | Mejora/alarga/acorta descripción (Claude Haiku). Gateada (1). Anti prompt-injection. | front invoke | sí | Anthropic · `ANTHROPIC_API_KEY` |
| **get-credits** | Saldo de créditos del owner (mensual+comprado); `ensure_ai_credits` primero. | front invoke | sí | `SERVICE_ROLE` |
| **create-credit-checkout** | Stripe Checkout de créditos (cantidad libre, precio server-side con descuento por volumen). | front invoke | sí | Stripe · `STRIPE_SECRET_KEY` |
| **confirm-credit-purchase** | Confirma compra de créditos al volver de Stripe (idempotente por session_id) → `add_purchased_credits`. | front invoke | sí | Stripe · `STRIPE_SECRET_KEY` |
| **ai-excel-mapper** | Mapea columnas de Excel a campos de producto con Claude (sonnet). | front invoke | sí | Anthropic |
| **notify-import-event** | Telemetría del hub de import: Slack (canal de errores) cuando un import Excel/PDF/fotos falla o un PDF importa bien, **+ traza en `catalog_imports`** (tenant por slug; `status` mapeado a success/partial/failed —CHECK de la tabla—, evento crudo en `event`, `detail`, page/product_count y el archivo fuente que el front sube lazy a `imports/<slug>/` en el bucket — link en el mensaje de Slack). La fila se inserta aunque el webhook falte. `ImportEventsService.registerFile()` en el front registra el archivo; se sube solo si un evento lo necesita. | front invoke | no (valida JWT a mano) | Slack · `SLACK_IMPORT_EVENTS_WEBHOOK` / Vault `slack_import_events_webhook` · `SERVICE_ROLE` |
| **notify-error** | Telemetría GENÉRICA de errores → mismo canal de Slack de errores. El front la llama desde 2 ganchos centrales que enchufa `provideSentry()` (core): el parche de `toast.error` (todo error mostrado al usuario, ~90 call sites cubiertos sin tocarlos) y el ErrorHandler global (`uncaught`, además de Sentry). Acepta reportes sin sesión (errores del catálogo público → "visitante"). Anti-ruido en el front: dedupe por mensaje + tope 15/sesión, no reporta en dev. | front invoke (+ anon) | no (JWT opcional a mano) | Slack · mismo webhook |
| **ses-events** | Webhook SNS de eventos de SES (config set catalogohoy-prod): persiste Send/Delivery/Bounce/Complaint/Open/Click/… en `ses_email_events` (RPC `ingest_ses_event`). **Bounce/Complaint/Reject además avisan al canal de Slack de errores** (destinatario, asunto, diagnóstico) — cubre los fallos de entrega de TODOS los senders de email en un solo punto. | webhook SNS | no (`?token=` + TopicArn) | AWS SNS/SES · `SES_EVENTS_WEBHOOK_TOKEN`, `SES_EVENTS_TOPIC_ARN` · Slack (mismo webhook) |
| **manage-stripe-coupons** | Admin interno: cupones + promotion codes de Stripe. | app internal | sí + `_assert_internal_admin()` | Stripe |
| **impersonate-tenant** | Admin interno (whitelist): magic link para impersonar owner. | app internal | sí + whitelist email | `SERVICE_ROLE` |
| **delete-account** | Borra la cuenta del usuario (users, ownerships si es único owner, users_tenants, auth.users). | front invoke | sí | `SERVICE_ROLE` |
| **posthog-analytics** | Query a PostHog (HogQL) para el dashboard de analíticas por `tenant_slug`. | front invoke | sí | PostHog · `POSTHOG_PERSONAL_KEY` |
| **countries-proxy** | Proxy + cache 24h de countriesnow.space (estados/ciudades). | front invoke | no | countriesnow.space |
| **notify-checkout-intent** | Discord embed cuando el user inicia checkout de plan. | front invoke | sí | Discord · `DISCORD_CHECKOUT_INTENT_WEBHOOK` |
| **enterprise-lead** | Lead del funnel "Contactar ventas" (plan Enterprise): valida payload (enums whitelist, email, caps, honeypot `company_hp`), re-puntúa el scoring server-side, inserta en `enterprise_leads` (service role) y notifica a Discord. La llama el admin (`functions.invoke`) y la landing (fetch crudo, sin sesión). | front invoke + landing | **no** (la publishable key no es JWT) | Discord · `DISCORD_ENTERPRISE_LEADS_WEBHOOK` (fallback `DISCORD_CHECKOUT_INTENT_WEBHOOK`) · `SERVICE_ROLE` |
| **send-whatsapp-notification** | Templates de WhatsApp (order_received, order_completed, plan_expiring, payment_failed) vía Meta Cloud API. Auth server-to-server por `x-webhook-secret`. Loguea a `whatsapp_notification_logs`. El trigger `notify_order_whatsapp()` la llama **una vez por destinatario**: `order_received` soporta hasta 2 números (`whatsapp_notification_settings.recipient_number` + `recipient_number_2`), el 2º gateado por `tenants.whatsapp_notify_numbers_limit` (null = 1; patrón `slug_change_limit`; hoy solo tenant 149 detalles-cecy = 2). Número emisor de la plataforma: +58 422-1464222 en la WABA `1038950559044032` (portfolio CatalogoHoy LLC verificado, `phone_number_id` `1312355171958953`, re-registrado ago-2026 tras el corte de entrega de la WABA vieja; plantillas re-aprobadas 2026-08-17, `plan_expiry_warning` y `order_pending_reminder` quedaron categoría MARKETING). Gotcha: la WABA necesita **método de pago propio** (Billing Hub → Cuentas de WhatsApp Business) — sin tarjeta asociada Meta acepta el wamid y descarta el mensaje (error 141006 en `GET /{phone_number_id}?fields=health_status`); resuelto 2026-08-17, entrega verificada. | cron/server | no (webhook-secret) | Meta · `WHATSAPP_*` |
| **send-whatsapp-test** | Test de WhatsApp desde el front (template hardcodeado). | front invoke | sí | Meta · `WHATSAPP_*` |
| **whatsapp-stats** | Costo/volumen REAL facturado por Meta para la WABA de plataforma (`pricing_analytics` por día, agregado a mes UTC y por `PRICING_CATEGORY`; fallback `conversation_analytics`). Gated `_assert_internal_admin`. Lo consume el panel interno "Notificaciones WhatsApp" junto con el RPC `whatsapp_notification_stats_admin` (agregado mensual por plantilla de `whatsapp_notification_logs`, filtra `created_at >= 2026-08-14` = re-registro del número en el portfolio nuevo; lo anterior salió por el portfolio viejo). Meta cobra por mensaje ENTREGADO → el volumen facturado es menor que los "sent" de nuestros logs. `WHATSAPP_WABA_ID` opcional (default `1038950559044032`). | front invoke (internal) | sí | Meta · `WHATSAPP_TOKEN` |
| **change-plan** | Upgrade de plan pago→pago más caro con **prorrateo real**: `subscriptions.update` sobre la sub existente (`always_invoice` + `error_if_incomplete`) → cobra SOLO la diferencia con la tarjeta guardada, sin redirect. Deja `plan_id` en el metadata de la sub (el webhook lo confirma) y actualiza el tenant + hermanos del owner. Valida que el caller sea owner/admin del tenant (users_tenants vía users.auth_user_id, si no 403) — cobra off-session, sin este check cualquier user podía cobrarle a otro tenant. Responde `no_active_subscription`/`not_an_upgrade`/`subscription_not_active`/`plan_item_not_found` → el front cae a `create-checkout-session`. ⚠️ PRICE_MAP duplicado de create-checkout-session: mantener sincronizados. | front invoke (plan-checkout `pay()`) | sí | Stripe · `STRIPE_SECRET_KEY`, `SERVICE_ROLE` |
| **stripe-webhook** | Webhook de Stripe (firma verificada): checkout completado (alta/upgrade), subscription updated/deleted (updated toma `metadata.plan_id` para upgrades vía `change-plan`; deleted = churn → plan a `gratis` + `previous_plan_id`), invoice succeeded/failed (retries + emails). Aplica rewards de referidos, manda Discord + email (SES principal, fallback MailerSend/Resend). **Crítico — no editar a ciegas.** | webhook Stripe | no (firma) | Stripe · SES · Discord · `STRIPE_WEBHOOK_SECRET`, `AWS_SES_*`, `DISCORD_PAYMENTS_WEBHOOK_URL` |
| **wa-webhook** | Webhook del CRM de WhatsApp (modelo BSP): mensajes entrantes de clientes, `smb_message_echoes` (espejo de lo que el comerciante responde desde su app en coexistencia), `history` (importación del historial, dedupe por wamid) y `smb_app_state_sync` (nombres de contactos). Descarga media entrante a Storage (`chat-media/`). Rutea al tenant por `phone_number_id`. **Workflows de la plataforma**: (a) entrantes al número de AVISOS (sin fila en `whatsapp_accounts`) → bandeja de soporte tenant 6 + auto-respuesta 1×24h (dedupe `wa_notify_autoreplies`) apuntando al número de soporte; (b) **bot de triaje del número de SOPORTE** (pnid `1011157635415699`, +58 422-0240947): al escribir un cliente manda menú de 3 botones interactivos (Tengo un problema / Pagar o renovar / Otra consulta) solo si el negocio no envió nada en 24h en ese chat (no interrumpe conversaciones activas + dedupe natural); al elegir responde el mensaje canónico + nota interna `🤖 Triaje` para el agente. Si lo último que envió el negocio fue el cierre por inactividad (prefijo de `wa-support-close`), el menú se re-muestra aunque no hayan pasado 24h (el cliente "reabre"). **Flujo VE "adquirir plan"**: si un número +58 manda el CTA de la landing/checkout ("…adquirir el plan X…"), en vez del menú se le ofrecen botones *Pago móvil* / *Transferencia*; al elegir se le mandan los datos reales (constantes `VE_PAGO_MOVIL` / `VE_TRANSFERENCIA`) + monto en Bs = USD del CTA × tasa `bcv_rates` (cron 4h), y nota interna con plan/método para que el agente verifique el comprobante y active. Apagar: `WA_SUPPORT_BOT=off`; pnid override `WA_SUPPORT_BOT_PNID`. | webhook Meta | no (GET verify token + firma `WA_APP_SECRET`) | Meta · `WA_WEBHOOK_VERIFY_TOKEN` |
| **wa-support-close** | Cierre por inactividad (estilo Zinli) de las conversaciones del número de SOPORTE (tenant 6): cada 10 min (pg_cron job `wa-support-close-10min` → `net.http_post`) busca chats sin actividad hace ≥30 min (`WA_SUPPORT_CLOSE_AFTER_MIN`) pero con último mensaje del cliente dentro de 20h (margen sobre la ventana de 24h) y donde el negocio participó, y envía "Esta conversación se cerró por inactividad ⏳ … escribí «hola»". El prefijo del mensaje es el marcador que `wa-webhook` usa para re-abrir con el menú — ⚠️ mantenerlos sincronizados. Dedupe: si el último mensaje ya es el cierre, no repite. Opts de prueba: `dryRun`, `closeAfterMin`, `onlyChatId`. | cron (10 min) | no (`x-webhook-secret` = `WA_SUPPORT_CLOSE_SECRET`) | Meta (token tenant 6) · `WA_SUPPORT_CLOSE_SECRET` |
| **wa-onboard** | Cierra el Embedded Signup: intercambia el `code` por token del comerciante (server-side, `FB_APP_SECRET`), suscribe la app a la WABA y upsertea `whatsapp_accounts` (onConflict `phone_number_id`). | front invoke | sí | Meta · `FB_APP_SECRET` |
| **wa-send** | Envía la respuesta del agente por Cloud API con el token DEL tenant (texto/imagen/documento, replies citadas). RLS del chat = autorización. 409 si el tenant no tiene número (modo demo → insert directo). | front invoke | sí | Meta (token por tenant en DB) |
| **wa-templates** | CRUD de plantillas del tenant contra la Graph API (list/create con ejemplos de variables/delete). | front invoke | sí | Meta (token por tenant) |
| **wa-transcribe** | Transcribe notas de voz del chat (Whisper vía fal.ai) → `chat_messages.transcript`. Idempotente (re-pedir es gratis). Gateada por créditos IA (1). | front invoke | sí | fal.ai · `FAL_KEY` |
| **ig-webhook** | Webhook de Instagram (Instagram Login, app CatalogoHoy-IG 1454226360079154): DMs entrantes, `is_echo` (respuestas desde la app de IG), `read` (✓✓ azul). Rutea por IGSID → `social_accounts` → tenant; chats con `channel='instagram'`. Media re-hospedada en Storage. | webhook Meta | no (verify token + firma) | Meta · `IG_APP_SECRET`, `IG_WEBHOOK_VERIFY_TOKEN` |
| **ig-send** | Respuesta del agente por Instagram DM con el token del tenant (`social_accounts`). Ventana 24h (sin plantillas), texto ≤1000 chars, imagen por URL. | front invoke | sí | Meta (token por tenant) |
| **ig-oauth** | Conexión del comerciante vía Instagram Login: POST (JWT manual) devuelve la URL de autorización con `state` HMAC; GET (redirect de IG) cambia code→token largo (60 días), upsertea `social_accounts` y suscribe webhooks. Redirect fijo server-side → sin problema de dominios por cliente. | front invoke + redirect IG | no (JWT manual en POST) | Meta · `IG_APP_ID`, `IG_APP_SECRET` |
| **tiktok-webhook** | **STUB (CAT-47)**: loguea eventos de TikTok Business Messaging y responde 200 + eco de challenge. Existe para registrar la URL durante la solicitud de acceso a la API (beta) y mapear el payload real. El front ya rutea `channel='tiktok'` a `tiktok-send`/`tiktok-oauth` (no existen aún); card de conexión oculta tras `tiktokCardVisible=false`. Reglas del canal: cliente escribe primero, ventana 48 h, máx 10 msgs/ventana, texto+imagen. | webhook TikTok | no (firma pendiente de doc) | TikTok Business API |

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
| **Google** | Workspace (correo @catalogohoy.com), OAuth (login), Search Console (SEO), GA4 (pendiente ID) | ver sección "Google" abajo · DNS en Vercel |

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

## Google (correo, login, SEO, analytics) — estado 2026-07-13

> El **DNS de `catalogohoy.com` se maneja en Vercel** (`vercel dns ls catalogohoy.com`).
> Nameservers de Vercel; los registros de Google se agregaron el 2026-07-05.

### Google Workspace (correo @catalogohoy.com)

- DNS ya configurado en Vercel: **MX** `1 smtp.google.com`, **DKIM** `google._domainkey`,
  **TXT** `google-site-verification=pN6QMx…` (verificación del dominio ante Google).
- ⚠️ **SPF pendiente**: el TXT actual es `v=spf1 include:zohomail.com ~all` (resto de la
  config vieja de Zoho) — **no incluye a Google**. Correos enviados por Workspace pueden
  fallar SPF (los salva DKIM, pero conviene arreglarlo): cambiar a
  `v=spf1 include:_spf.google.com include:zohomail.com ~all` (o quitar Zoho si ya no se usa).
  Se puede hacer por CLI: `vercel dns` (rm + add).

### Google OAuth (login/signup)

- Vía Supabase Auth (provider Google). Frontend en `libs/catalogohoy/auth`
  (`complete-google-signup.usecase.ts`, botones en login/signup). Config del provider en el
  dashboard de Supabase (Client ID/Secret de Google Cloud Console).

### SEO / Search Console — quién sirve cada robots/sitemap

| Superficie | robots.txt | sitemap.xml |
|---|---|---|
| **Landing** (`catalogohoy.com`) | estático en `apps/landing/public/` (**rama `landing`**) | estático en `apps/landing/public/` (**rama `landing`**, actualizado 2026-07-09: `/`, `/pricing`, `/features`, `/faq`) |
| **Help** (`help.catalogohoy.com`) | estático en `apps/help/public/` | **autogenerado en build** por `apps/help/scripts/gen-sitemap.mjs` (escanea el `dist/` del SSG). No editar a mano. |
| **Storefronts** (`{slug}.catalogohoy.com` + dominios custom) | **dinámico**: `api/robots.ts` | **dinámico**: `api/sitemap.ts` |

- **Storefronts** (funciones Vercel del proyecto `catalogohoy-dashboard`, rama `main`):
  - `vercel.json` (raíz) reescribe `/sitemap.xml → /api/sitemap` y `/robots.txt → /api/robots`
    (antes del catch-all de la SPA). El robots.txt estático de `apps/catalogohoy/public/` se
    **eliminó** — si se recrea, el filesystem le gana al rewrite y mata la versión dinámica.
  - Resolución de tenant igual que `middleware.ts`: subdominio → slug; otro host →
    `tenants.custom_domain` (apex, sin `www.`). Hosts reservados (`www/auth/help/internal/api/mail`)
    o desconocidos (previews `*.vercel.app`) → robots `Disallow: /` y sitemap 404.
  - Sitemap por tenant: portada + `/product/{id}` de productos **no ocultos**
    (`is_hidden`), con `lastmod` = created_at. Si el catálogo está **cerrado**
    (`tenant_ecommerce_config.is_visible=false`) o el **plan vencido** → solo la portada.
    robots deshabilita `/admin/`, `/checkout`, `/order/`, `/public/`, etc.
  - Usa la **anon key** por REST (todas las tablas necesarias tienen SELECT público).
- **Crawlers** (Googlebot incluido) reciben el HTML de `middleware.ts` (matcher `/` y
  `/product/:path*`) — la SPA no se les sirve. Desde 2026-07-13 ese HTML va **enriquecido
  para SEO**: portada con lista real de productos (nombre, precio, link a `/product/{id}`,
  máx 60) + JSON-LD `Store`/`ItemList`; producto con descripción/foto/precio + JSON-LD
  `Product` con `Offer` (precio, moneda, disponibilidad según `is_sold_out`) → habilita
  resultados enriquecidos en Google. Moneda del JSON-LD: `product_currency`, salvo **VE**
  donde los precios se guardan en la referencia → `display_currency` (ver gotcha de
  moneda). Precio 0 = "sin precio": no se muestra ni lleva Offer.

### Google Search Console

- La verificación **ya está** a nivel dominio (TXT en el DNS) → una propiedad de dominio
  `catalogohoy.com` cubre apex + **todos** los subdominios (storefronts incluidos).
- Sitemaps a enviar en la propiedad: `https://catalogohoy.com/sitemap.xml`,
  `https://help.catalogohoy.com/sitemap.xml` y los de tenants clave
  (ej. `https://catalogohoy.catalogohoy.com/sitemap.xml`). Los dominios custom de clientes
  (ej. `3sxpress.com`) necesitarían su propia propiedad — es del cliente, no nuestra.

### Google Analytics 4

- Propiedad GA4 creada 2026-07-13 — **ID de medición `G-TL9DYGTFED`**.
- Snippet gtag en `apps/catalogohoy/src/index.html` (guard: **no** carga en `/admin` ni en
  localhost). Los page_view de navegación SPA los cubre la "medición mejorada" de GA4
  (history changes).
- Landing: snippet estándar de gtag en `apps/landing/index.html` (**rama `landing`**).
- Convive con PostHog (producto) y Meta Pixel (ads); GA4 es para adquisición/SEO/Google Ads.
