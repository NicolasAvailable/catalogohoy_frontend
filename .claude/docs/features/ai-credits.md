# Features — Sistema de créditos de IA + IA en productos

> Construido jun 2026. Números en `business-rules.md`. Edge functions en `integrations.md`.

## Modelo de créditos (por OWNER, no por catálogo)

- Pozo por **owner = `users.id`** (mapeado desde el `auth.uid()` del JWT). Tabla
  `ai_credits(user_id PK, monthly_balance, monthly_allowance, purchased_balance, reset_at, updated_at)`.
  **Dos cubetas**: mensual (se resetea) + comprada (persiste). Se gasta primero la mensual.
- RLS: el owner solo **lee** su fila; nadie escribe desde el cliente.
- **Allowance** = mayor plan entre los catálogos del owner: gratis 10 · básico 200 · avanzado 500.

### RPCs (SECURITY DEFINER, execute solo service_role)

- `ensure_ai_credits(user)` — crea el pozo si no existe (allowance del plan).
- `spend_ai_credits(user, cost)` — atómica (FOR UPDATE): gasta mensual→comprada, devuelve nuevo
  saldo o **-1 si no alcanza**.
- `refund_ai_credits(user, cost)` — devuelve crédito si la IA falla.
- `add_purchased_credits(user, amount)` — suma a la cubeta comprada.
- `reset_due_ai_credits()` — cron diario (`reset-ai-credits-daily`, pg_cron): repone
  `monthly_balance=monthly_allowance` de los pozos con `reset_at<=now()`, recalcula el allowance
  del plan actual (maneja up/downgrades), re-ancla `reset_at` +1 mes, **no toca** lo comprado.
- `sync_ai_credits_on_plan_change()` — **trigger** en `tenants` AFTER UPDATE OF plan_id: al subir
  de plan acredita el saldo al nuevo allowance de inmediato; al bajar espera al reset. Defensivo
  (`exception when others then return NEW`) → **nunca bloquea el cambio de plan** ni toca el webhook.

## Features de IA (en el form de producto, `save.html`)

| Acción | Modelo / función | Costo | Notas |
|---|---|---|---|
| **Generar imagen** | FLUX schnell (`fal-ai-images` action `generate`) | 3 | Prompt fuerza **texto en español** en la imagen. Modal `ui-dialog` "🪄 Generar imagen con IA". |
| **Quitar fondo** | BiRefNet (`remove-background`) | 1 | Botón sobre cada imagen. |
| **Borrador a mano** | Canvas local (pincel, estilo Canva) + `uploadPng` | **0** | No pasa por edge function (no consume créditos). |
| **Mejorar descripción** | Claude Haiku 4.5 (`improve-text`) | 1 | `ui-select` con modos mejorar/alargar/acortar (≥15 chars). Anti prompt-injection (texto = datos, delimitado). |

- **Gate** (en `fal-ai-images` v9 + `improve-text` v2): resuelve owner desde JWT → `ensure` →
  `spend` ANTES de llamar al modelo → `refund` en catch si falla. 402 `code:"no_credits"` si no
  alcanza. Las respuestas success incluyen `credits` (saldo restante) → el front actualiza el chip.
- **Servicios front**: `AiImageService` (`removeBackground`, `generate`, `improveText`, `uploadPng`)
  + `CreditsStore` (`balance` signal, `load()`, `setBalance()`, `buyCredits()`, `confirmPurchase()`).
  `AiImageService` actualiza el saldo desde cada respuesta.

## UI de créditos

- **Chip reactivo en el navbar** (`CreditsWidgetComponent`, exportado de `@catalogohoy/product`,
  montado en `apps/catalogohoy/.../navbar`): "✨ N créditos", baja al consumir (CreditsStore singleton).
  En **móvil** el chip se oculta y los créditos + "Comprar" van en el **dropdown del perfil**
  (`ProfileMenu` emite `buyCredits` → el navbar llama `creditsWidget.open()`).
- **Comprar**: diálogo `ui-dialog` con **builder** — presets (150/500/1000/2000) + slider + ± +
  precio/descuento en vivo + "Continuar al pago". Precio **autoritativo en el servidor**
  (`create-credit-checkout`); el front replica la tabla solo para mostrar (`creditQuote` en
  `credits.store.ts` — si cambia el pricing, cambiar las DOS).
- **Retorno de Stripe**: el widget lee `?credits_session=` en `ngOnInit` → `confirm-credit-purchase`
  → limpia el param.

## Anuncio de IA en Home

Modal `ui-dialog` (dos columnas: captura del editor + lista de features) que se muestra una vez
por cuenta (`users.seen_announcements`, clave `ai_v1`). Ver `features/supporting.md` (home).
