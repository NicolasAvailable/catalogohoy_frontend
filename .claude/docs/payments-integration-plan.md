# Pasarelas de Pago — Plan de implementación

> **Estado: DIFERIDO** hasta tener la empresa registrada (Stripe Atlas / EIN).
> Este doc consolida la investigación, la arquitectura y la foundation ya
> construida, para retomar la implementación sin re-derivar nada.
> Linear: proyecto **"Pasarelas de Pago"** (CAT-24…CAT-30).

---

## 1. La decisión y el porqué

Objetivo: que cada **comerciante** (tenant) cobre online en su catálogo, con el
dinero yendo **directo a su cuenta**. CatalogoHoy NO toca los fondos ni cobra
comisión por transacción (se monetiza por el plan Pro).

Hay **solo dos modelos** para conectar la pasarela del comerciante, y no existe
un tercero:

| | **Connect / OAuth** (botón "Conectar") | **Paste-key** (pegar llaves) |
|---|---|---|
| UX | Un click → onboarding hosted de la pasarela → te devuelve `access_token`/`acct_id` | El comerciante copia su key y la pega |
| ¿Necesita la empresa de la PLATAFORMA? | **Sí** (cuenta de plataforma con Connect habilitado = Atlas/EIN para vivo) | **No** |
| ToS | Oficial / limpio | Zona gris (Stripe recomienda Connect; MP documenta OAuth) |
| Comisión automática | Opcional (`application_fee`) | No |
| ¿Cobra en vivo HOY (sin empresa)? | No | **Sí** |

**Conclusión:** el botón de onboarding lindo (Connect/OAuth) **siempre** requiere
que la plataforma tenga empresa. Por eso se difiere: cuando exista la empresa US
(Atlas → EIN), se implementa Connect como método principal. Mientras tanto, si se
quisiera lanzar antes, paste-key funciona sin empresa pero es más manual.

**Plan recomendado al retomar:**
1. Con la empresa lista → **Stripe Connect** (Express u OAuth Standard) como
   método estrella (mejor UX, ToS limpio).
2. La lib ya separa `connection_type: 'oauth' | 'api_keys'`, así que se puede
   ofrecer paste-key para pasarelas sin Connect (Wompi, Culqi, Flow) y Connect
   para Stripe / Mercado Pago. **Sin rehacer nada.**

---

## 2. Arquitectura objetivo

```
Tab "Pagos" (editar catálogo)
├── Pagos manuales   → lo actual (efectivo, Zelle, Pago Móvil, transferencia…)
└── Pagos automáticos → pasarelas. Gating por país del catálogo:
                        providersForCountry(countryCode, showAll)
                        · dev: showAll=true (todas, para probar)
                        · prod: filtra por country_code

Flujo de cobro (genérico, igual para las 5 verificadas):
1. CONECTAR   Comerciante conecta su cuenta (OAuth o pega keys) → tenant_payment_accounts
2. COBRAR     Cliente paga → edge fn crea checkout/preference con la credencial
              del comerciante → redirige al hosted checkout de la pasarela
3. CONFIRMAR  Webhook server-to-server → verifica → orders.payment_status='paid'
              → dispara la notificación WhatsApp existente
```

**Capas:**
- **Lib `@catalogohoy/payments`** (domain/infrastructure/presenter) con
  `BasePaymentProviderService` + una implementación por pasarela.
- **DB**: `tenant_payment_accounts` (credenciales por comerciante) + columnas de
  pago en `orders`.
- **Edge functions** (Supabase, patrón de WhatsApp): `{provider}-connect`
  (valida/onboarding), `{provider}-create-checkout` (crea sesión → redirect),
  `{provider}-webhook` (confirma → marca orden paid).
- **UI**: sección "Pagos automáticos" en el tab Pagos + botón "Pagar online" en
  el checkout público (`checkout-drawer`).

---

## 3. Foundation YA construida (head start, sin aplicar a prod)

- **Lib `@catalogohoy/payments`** creada y compilando:
  - `src/domain/payment.ts` — modelos: `PaymentProviderId`, `PaymentConnectionType`,
    `PaymentAccount`, `OrderPaymentStatus`, `PaymentCredentialsInput`.
  - `src/domain/payment-provider.registry.ts` — `PAYMENT_PROVIDERS` (registro
    país→pasarela) + `providersForCountry()` + `getProviderMeta()`.
  - Path agregado en `tsconfig.base.json` (`@catalogohoy/payments`).
- **Migración** `supabase/migrations/20260609_payments_foundation.sql`
  (**dry-run validada contra prod, NO aplicada**):
  - Tabla `tenant_payment_accounts`: `tenant_id`, `provider`, `connection_type`,
    `public_key`, `access_token`, `refresh_token`, `webhook_secret`,
    `external_account_id`, `country_code`, `status`, `is_enabled`,
    `token_expires_at`, timestamps. UNIQUE(tenant_id, provider). RLS por miembro
    del tenant (vía `users_tenants` JOIN `users` on `auth_user_id = auth.uid()`).
    Secretos limitados a miembros; el catálogo público (anon) no los lee; las
    edge functions usan service_role.
  - `orders`: `payment_status` (default 'unpaid'), `payment_provider`,
    `payment_id`, `paid_at`.

Para retomar: aplicar la migración (`mcp__supabase__apply_migration`) y seguir
con las edge functions + UI.

---

## 4. Research por pasarela (verificado adversarialmente, con fuentes)

Patrón común confirmado en las 5: **hosted checkout / redirect → webhook de
confirmación → el comerciante aporta sus credenciales.** Esto valida una
abstracción única `crearCheckout(orden, credenciales) → urlRedirect` +
`procesarWebhook(payload) → estado`.

### Stripe (global) — `connection_type: api_keys` (paste-key) o Connect
- **Redirect:** Checkout Session hosted — `POST /v1/checkout/sessions` devuelve
  `url` (checkout.stripe.com) + `success_url`/`cancel_url`.
  <https://docs.stripe.com/api/checkout/sessions/create>
- **Paste-key (Opción B):** la `secret key` (sk_) del comerciante se usa como
  username en HTTP Basic Auth; los cargos se liquidan en su cuenta sin Connect.
  ⚠️ Stripe **recomienda Connect** para multi-merchant (riesgo ToS a escala).
  <https://docs.stripe.com/api/authentication>
- **Persona natural:** requiere TIN verificable (SSN/ITIN para sole proprietor;
  EIN si empresa). No se puede sin tax ID.
  <https://support.stripe.com/questions/signing-up-for-a-us-stripe-account-without-a-tax-id-or-employer-id-number>
- **Connect (cuando haya empresa):** botón "Conectar" → onboarding hosted →
  `acct_id` (+ access_token en OAuth Standard). Cobro con `Stripe-Account` header
  o destination charge. Comisión opcional con `application_fee_amount`.
- **Test mode:** se puede construir/probar Connect en test SIN empresa; el cobro
  EN VIVO necesita activar la cuenta plataforma (Atlas/EIN).

### Mercado Pago (AR/MX/CO/CL/PE/BR/UY)
- **Credenciales:** Public Key (frontend) + Access Token (backend, secreto) por
  integración. Panel: Developers → Tus integraciones → Producción → Credenciales.
  <https://www.mercadopago.com.co/developers/es/docs/credentials>
- **Terceros / Opción B:** el mecanismo **documentado** para cobrar en nombre de
  otros es **OAuth** (registrar app de desarrollador → client_id/secret). El
  paste-directo del Access Token del vendedor funciona técnicamente pero NO es su
  patrón oficial. También permite "compartir credenciales" (máx 10 veces).
  <https://www.mercadopago.com.br/developers/en/docs/security/oauth>
- **OAuth de plataforma:** requiere cuenta MP en país soportado. **Bloqueado para
  un titular venezolano** (no puede abrir cuenta MP en AR/MX/… sin datos locales;
  MP Venezuela está pausado). → MP queda como paste-key (con su matiz de ToS) o
  diferido hasta tener presencia/cuenta en un país soportado.
- **Persona natural (MX):** RFC se obtiene online en el SAT solo con CURP; el RFC
  NO es indispensable para cobrar (claim contrario refutado 0-3).

### Wompi (Colombia) — `connection_type: api_keys` (el más limpio)
- **Persona natural:** ✅ sin Cámara de Comercio; solo RUT/cédula + cuenta
  bancaria propia (>30 días de antigüedad, incl. Nequi) + selfie.
  <https://soporte.wompi.co/hc/es-419/articles/360021056453>
- **Credenciales:** private key `prv_` (Bearer, para crear) + public key `pub_`
  (verificar estado). El comerciante pega ambas.
- **Redirect:** `redirect_url` en `/v1/transactions`.
- **Confirmación:** la transacción nace **PENDING** siempre → webhook
  `transaction.updated` o polling. <https://docs.wompi.co/en/docs/colombia/transacciones/>
- **Moneda:** solo COP.

### Culqi (Perú) — `connection_type: api_keys`
- **Webhook OBLIGATORIO** (`order.status.changed`) para confirmar pago.
- **Checkout** low-code; habilita **Yape, PagoEfectivo, Cuotéalo**, tarjetas.
  <https://docs.culqi.com/es/documentacion/pagos-online/ordenes-de-pago/resumen/>

### Flow (Chile) — `connection_type: api_keys`
- **Dos URLs:** `urlReturn` (redirect del navegador) + `urlConfirmation` (webhook
  server-to-server: POST `token` → luego `payment/getStatus`).
  <https://developers.flow.cl/en/docs/tutorial-basics/create-order>

---

## 5. Mapa país → pasarela (gating del tab "Pagos automáticos")

Definido en `payment-provider.registry.ts` (`countries`):

| Pasarela | Países | Conexión |
|---|---|---|
| **Stripe** | `*` (global) | api_keys (→ Connect con empresa) |
| **Mercado Pago** | AR, MX, CO, CL, PE, BR, UY | api_keys (→ OAuth con cuenta MP) |
| **Wompi** | CO | api_keys |
| **Culqi** | PE | api_keys |
| **Flow** | CL | api_keys |

`providersForCountry(cc, showAll)` → en dev `showAll=true` (todas); en prod
filtra por `country_code` del catálogo (las `*` siempre aparecen).

---

## 6. Riesgos abiertos / a re-verificar antes de producción

1. **ToS / compliance (el más importante):** ninguna pasarela se verificó sobre
   si sus Términos **permiten o prohíben** que un tercero cobre con las keys del
   comerciante sin Connect. Stripe recomienda Connect; MP documenta OAuth.
   Validar legal antes de escalar paste-key. → **Otra razón para preferir
   Connect/OAuth (con empresa).**
2. **Comisiones (% + fija), límites KYC, tiempos de retiro:** NO verificados para
   ninguna; cambian seguido → sacarlos de las páginas oficiales al implementar.
3. **Pasarelas sin cubrir:** Recurrente (GT/CA), Tilopay/ONVO (CR), PagBank (BR),
   PayPhone (EC), y todas las de prioridad media (PayPal, Square, Mollie, Bold,
   Clip, Conekta, Khipu, Pagopar, Pagofácil/Libélula). Falta otra ronda de
   research para completar la tabla.

---

## 7. Secuencia de implementación (cuando se retome, con la empresa)

1. **F0 Foundation** (CAT-24) — ya scaffolded: aplicar la migración a prod.
2. **Stripe Connect** (CAT-28) — habilitar Connect en la cuenta plataforma
   (Atlas/EIN); edge fn `stripe-connect` (Account Link / OAuth) → guardar
   `acct_id`; `stripe-create-checkout` (destination charge) → redirect;
   `stripe-webhook` (`checkout.session.completed`) → orden paid.
3. **Tab "Pagos automáticos"** (CAT-26) — UI con `providersForCountry`, botón
   Conectar (Connect) o form de keys (paste), estado, gating por país.
4. **Checkout público** (CAT-29) — botón "Pagar online" en `checkout-drawer` →
   create-checkout → redirect; al volver, orden refleja estado de pago.
5. **Mercado Pago** (CAT-25/27) — OAuth si hay cuenta MP en país soportado; si no,
   paste-key.
6. **Locales** — Wompi (CO), Culqi (PE), Flow (CL) por paste-key, reusando el
   mismo `BasePaymentProviderService`.
7. **Comisión / panel** (CAT-30) — opcional, si se decide cobrar fee.

---

## 8. Prerrequisitos para ir EN VIVO

- **Connect (Stripe/MP):** empresa registrada (Stripe Atlas → EIN) + activar la
  cuenta de plataforma con Connect.
- **Paste-key:** nada del lado plataforma; cada comerciante necesita su propia
  cuenta en la pasarela (persona natural OK en CO/MX/PE/CL/…).

---

## 9. Linear

Proyecto **Pasarelas de Pago** (team Catalogo hoy):
CAT-24 (F0 Foundation) · CAT-25 (MP Connect) · CAT-26 (tab Pagos) ·
CAT-27 (cobro MP) · CAT-28 (Stripe Connect) · CAT-29 (checkout UX + estado) ·
CAT-30 (comisión + panel). **P8** (catálogo de pasarelas por país) quedó
pendiente de crear — el MCP de Linear estaba rechazando escrituras (transporte
`/sse` deprecado); reconectar a `https://mcp.linear.app/mcp` y crearlo.
