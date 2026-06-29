# WhatsApp CRM multi-tenant (CatalogoHoy como BSP) — Plan técnico

> **Modelo (confirmado 2026-06-27):** cada **comerciante** (tenant) conecta **su
> propio número de WhatsApp** vía Embedded Signup y atiende a **sus** clientes
> desde el CRM. CatalogoHoy actúa como **proveedor de tecnología / BSP** para sus
> comerciantes (como TakeApp lo es para CatalogoHoy). **Independiente** del número
> +58 de notificaciones (ese es compartido, sólo saliente, NO se toca).
> Rama: `integration/chat-crm`. Linear: proyecto "WhatsApp Business + CRM".

---

## 1. Estado actual (verificado vía MCP + lectura de código, 2026-06-27)

**Meta:**
- App BSP **CatalogoHoy WS**, App ID `1533064975039243`, portfolio "Catálogo Hoy"
  (negocio **verificado** ✅), caso de uso "Conectarse con clientes vía WhatsApp",
  marcada como **proveedor de tecnología** (started).
- Número de **prueba** de la app: `+1 555 653-0274`, `phone_number_id`
  `1196341476894927`, WABA de prueba `1335916461337666`.
- System user `catalogohoy-whatsapp` (id `61590782151320`) con token
  (⚠️ el user pegó uno en el chat → **revocar**).

**DB (prod):** migración `20260622_whatsapp_crm_foundation` **aplicada**. Tablas:
`chats` (1195), `chat_messages`, `whatsapp_accounts` (2 filas DEMO, sin
phone_number_id), `pipeline_statuses`, `quick_replies`. RLS por tenant + realtime
sobre chats/chat_messages OK. RPCs del simulador (`post_demo_customer_message`,
`get_demo_chat_messages`).

**Frontend (lib `@catalogohoy/whatsapp` + `@catalogohoy/chat`):**
- `FacebookSdkService` — carga el JS SDK, `launchEmbeddedSignup()` (usa
  `config_id`, `response_type:'code'`, `sessionInfoVersion:'3'`),
  `onEmbeddedSignupMessage()` (escucha `WA_EMBEDDED_SIGNUP` → FINISH/CANCEL/ERROR).
  Lee `environment.whatsapp.{facebookAppId, facebookConfigId, graphApiVersion}`.
- `WhatsAppStore` — `registerFromEmbeddedSignup(payload)`, `connectDemoAccount()`,
  `loadAccounts()`, `removeAccount()`.
- `EmbeddedSignupPayload = { wabaId, phoneNumberId, authCode }`.
- `ChatService` — inbox + `sendMessage()` (hoy **sólo inserta** en chat_messages),
  `ChatRealtimeService` (realtime), ficha CRM, quick replies.

**Edge functions:**
- `wa-webhook` (repo, **NO desplegada**) — GET verify + POST entrante; rutea por
  `phone_number_id` → tenant (vía `whatsapp_accounts`); inserta en chat_messages.
- `wa-send` (recién creada, **NO desplegada**) — saliente; **hoy usa token global
  `WHATSAPP_TOKEN`** → hay que cambiarla a token por-comerciante.
- `send-whatsapp-notification` (prod, viva) — notifs salientes desde el +58. **NO tocar.**

---

## 2. Los gaps (qué falta para el modelo BSP real)

| # | Gap | Capa |
|---|---|---|
| G1 | `whatsapp_accounts` sin columna `access_token` (token por comerciante) | DB |
| G2 | No hay **intercambio server-side** del `authCode` → token del comerciante | Backend |
| G3 | `createAccountFromSignup` inserta directo desde el front (inseguro, sin token) | Frontend/Backend |
| G4 | No se **suscribe la app del BSP a la WABA** del comerciante (sin esto no llegan webhooks) | Backend |
| G5 | `wa-send` usa token global, no el del comerciante | Backend |
| G6 | `wa-webhook` sin desplegar + sin verificación de firma `X-Hub-Signature-256` | Backend |
| G7 | `ChatService.sendMessage` no llama a `wa-send` (no envía por WhatsApp real) | Frontend |
| G8 | Falta **config de Embedded Signup** (`config_id`) + `facebookAppId` en env | Meta + config |
| G9 | **App Review** de `whatsapp_business_messaging` (Advanced Access) para comerciantes externos | Meta (gate) |
| G10 | Webhook a nivel de app (callback URL = wa-webhook) sin configurar | Meta |
| G11 | Gating por plan + billing de conversaciones (¿quién paga?) | Producto |

---

## 3. Arquitectura objetivo

```
ONBOARDING (Embedded Signup)
 Comerciante (panel) ──"Conectar WhatsApp"──▶ FB.login(config_id) [Meta]
   │  Meta devuelve: code (authResponse) + postMessage{ waba_id, phone_number_id }
   ▼
 Frontend ──{ wabaId, phoneNumberId, authCode, tenantId }──▶ edge fn `wa-onboard`
   │   wa-onboard (service role):
   │     1. POST /oauth/access_token (client_id+secret+code) → business token del comerciante
   │     2. POST /{phone_number_id}/register (si hace falta) + PIN
   │     3. POST /{waba_id}/subscribed_apps  (suscribe la app del BSP a la WABA)
   │     4. INSERT whatsapp_accounts { tenant_id, waba_id, phone_number_id,
   │                                   access_token, phone_number, display_name, status }
   ▼
 whatsapp_accounts (1 fila por comerciante, con SU token)

INBOUND (cliente → comerciante)
 Cliente WhatsApp ─▶ número del comerciante ─▶ Meta ─▶ webhook app ─▶ edge fn `wa-webhook`
   wa-webhook (service role, verify_jwt=false):
     - valida X-Hub-Signature-256 (app secret)
     - resuelve tenant por phone_number_id (whatsapp_accounts)
     - find-or-create chat (tenant, telefono cliente) → insert chat_messages(is_mine=false)
 Inbox del comerciante recibe por **realtime** (ya implementado).

OUTBOUND (comerciante → cliente)
 Agente escribe en CRM ─▶ ChatService.sendMessage ─▶ edge fn `wa-send`
   wa-send (verify_jwt=true, JWT del agente):
     - verifica membresía del tenant (RLS leyendo el chat)
     - lee whatsapp_accounts del tenant → access_token + phone_number_id DEL COMERCIANTE
     - POST /{phone_number_id}/messages (texto libre, ventana 24h) con SU token
     - insert chat_messages(is_mine=true) + update chats
```

---

## 4. Cambios de DB (migración nueva)

`supabase/migrations/2026MMDD_whatsapp_crm_bsp.sql` (idempotente):
```sql
ALTER TABLE public.whatsapp_accounts
  ADD COLUMN IF NOT EXISTS access_token     text,      -- token del comerciante (Vault a futuro)
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_name    text,
  ADD COLUMN IF NOT EXISTS quality_rating   text;
-- Un comerciante = un número activo (ajustar si se permiten varios):
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_phone_number_id_uniq
  ON public.whatsapp_accounts (phone_number_id) WHERE phone_number_id IS NOT NULL;
```
- `access_token` **nunca** se expone a `anon`/`authenticated` por el SELECT del
  front (hoy el SELECT lista columnas explícitas SIN el token → mantener así). Las
  edge functions lo leen con **service role**. (Endurecer con Vault en una 2ª pasada.)

---

## 5. Edge functions

### `wa-onboard` (NUEVA) — intercambio del code + alta del comerciante
- `verify_jwt=true` (la llama el comerciante autenticado).
- Input: `{ wabaId, phoneNumberId, authCode }`. Resuelve tenant del JWT (membresía).
- Pasos:
  1. `GET https://graph.facebook.com/{v}/oauth/access_token?client_id=APP_ID&client_secret=APP_SECRET&code=AUTH_CODE` → `access_token` del comerciante (token de negocio de larga duración).
  2. (Opc.) `POST /{phone_number_id}/register` con un PIN de 6 dígitos si el número lo requiere.
  3. `POST /{waba_id}/subscribed_apps` (con el token) → suscribe la app del BSP a esa WABA (habilita webhooks entrantes).
  4. `GET /{phone_number_id}` → `display_phone_number`, `verified_name`, `quality_rating`.
  5. `INSERT whatsapp_accounts` (service role) con token + datos.
- Secrets: `WA_APP_ID`, `WA_APP_SECRET`, `WHATSAPP_API_VERSION`.

### `wa-webhook` (EXISTE, ajustar + desplegar)
- `verify_jwt=false`. GET verify (`WA_WEBHOOK_VERIFY_TOKEN`). POST entrante.
- **Agregar**: validar `X-Hub-Signature-256` con `WA_APP_SECRET` (HMAC SHA256 del raw body).
- **Agregar**: manejar tipos (text, image/document/audio → guardar media URL), y
  los `statuses` (sent/delivered/read/failed) para marcar mensajes.
- Ya rutea por phone_number_id → tenant (correcto).

### `wa-send` (EXISTE local, AJUSTAR)
- Cambiar de `WHATSAPP_TOKEN` global → **leer `access_token` + `phone_number_id`
  del `whatsapp_accounts` del tenant del chat** (service role). Enviar con SU token.
- Mantener: verificación de membresía vía JWT, persistir is_mine=true, manejar
  error #131047 (fuera de ventana 24h → la UI pide plantilla).

---

## 6. Frontend

- `WhatsAppService.createAccountFromSignup` → en vez de `insert` directo, llamar a
  `wa-onboard` (`functions.invoke('wa-onboard', { wabaId, phoneNumberId, authCode })`).
- `whatsapp-setup` → botón "Conectar WhatsApp" que: `loadSdk()` →
  `onEmbeddedSignupMessage()` (captura waba_id/phone_number_id) → `launchEmbeddedSignup()`
  (captura `code`) → al FINISH, `registerFromEmbeddedSignup({wabaId, phoneNumberId, authCode})`.
- `ChatService.sendMessage(chatId, content, isMine=true)` → llamar `wa-send`
  (que inserta server-side) en lugar del insert directo. Mantener el simulador
  (demo / is_mine=false) como está.
- `environment.whatsapp`: `facebookAppId='1533064975039243'`, `facebookConfigId=<config Embedded Signup>`, `graphApiVersion='v21.0'`.

---

## 7. Configuración Meta + gates

1. **Embedded Signup config** (`config_id`): en la app → WhatsApp → "Embedded
   Signup" / "Configuración" → crear una configuración → copiar el `config_id` →
   env `facebookConfigId`.
2. **Facebook Login for Business**: producto agregado a la app (para FB.login).
3. **Webhook a nivel de app**: app → WhatsApp → Configuration → Callback URL =
   `https://<project>.supabase.co/functions/v1/wa-webhook`, Verify token =
   `WA_WEBHOOK_VERIFY_TOKEN` (`catalogohoy-wa`), suscribir campo `messages`.
4. **Proveedor de tecnología** (started ✅).
5. **🚧 App Review**: `whatsapp_business_messaging` + `whatsapp_business_management`
   en **Advanced Access**. Hasta aprobarlo, sólo funciona en **dev** (números de
   prueba / el propio negocio). **Tarda días.** → es el gate de la Fase 2.

---

## 8. Secrets (Supabase) — NUEVOS, no pisan los de notificaciones

| Secret | Uso |
|---|---|
| `WA_APP_ID` = `1533064975039243` | wa-onboard (code exchange) |
| `WA_APP_SECRET` | wa-onboard + firma webhook |
| `WA_WEBHOOK_VERIFY_TOKEN` = `catalogohoy-wa` | wa-webhook GET verify |
| `WHATSAPP_API_VERSION` (ya existe) | versión Graph |

> **NO tocar** `WHATSAPP_TOKEN` ni `WHATSAPP_PHONE_NUMBER_ID` (son de las
> notificaciones del +58, vivas en prod).

---

## 9. Seguridad
- Token del comerciante: server-side only (service role). El SELECT del front no lo
  incluye. Endurecer con **Vault** (pgsodium) en 2ª pasada.
- `wa-webhook`: validar `X-Hub-Signature-256` (rechazar payloads no firmados).
- `wa-send`: membresía del tenant vía JWT (RLS) antes de enviar.
- `wa-onboard`: el code exchange usa el **app secret** → jamás en el front.

---

## 10. Gating por plan / billing (decisión de producto)
- ¿Qué planes incluyen el CRM de WhatsApp? (pro-gate como otras features).
- **Billing de conversaciones**: en BSP, cada WABA del comerciante tiene su método
  de pago. Definir: ¿el comerciante pone su tarjeta en su WABA, o CatalogoHoy
  cubre con una línea de crédito y lo cobra en el plan? (impacto de costos).

---

## 11. Fases

**Fase 1 — Build + test con número de prueba (SIN esperar a Meta):**
1. Migración `access_token` (+ columnas) → aplicar a prod (idempotente, seguro).
2. `wa-send` → token por-comerciante. `wa-webhook` → firma + tipos. Desplegar ambas.
3. `wa-onboard` → crear + desplegar.
4. Secrets `WA_APP_ID`, `WA_APP_SECRET`, `WA_WEBHOOK_VERIFY_TOKEN`.
5. Config Embedded Signup (`config_id`) + Facebook Login + webhook de la app.
6. Frontend: cablear `createAccountFromSignup→wa-onboard`, `sendMessage→wa-send`,
   env.
7. **Probar E2E** conectando el **número de prueba** y mandando/recibiendo
   (el dev/owner puede usar Embedded Signup en modo dev sin App Review).

**Fase 2 — Producción para comerciantes externos:**
1. **App Review** (`whatsapp_business_messaging` Advanced Access) → aprobado.
2. Embedded Signup público; los comerciantes conectan sus números reales.
3. Endurecer tokens (Vault), gating por plan, billing.

---

## 12. Decisiones abiertas
- Billing de conversaciones (comerciante vs CatalogoHoy).
- ¿Un número por comerciante o varios? (índice único asume uno).
- Plantillas: gestión de plantillas por comerciante (para mensajes fuera de 24h).
- Vault para tokens (cuándo).
