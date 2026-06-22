# Reglas de negocio

> Números y reglas que NO se deducen del código. Si cambian, actualizar acá + el código.

## Planes

| Plan | Precio (mes) | Productos | Catálogos | Miembros equipo | Variantes/producto | Créditos IA/mes |
|---|---|---|---|---|---|---|
| **gratis** | $0 | 1 (visible en catálogo público) | 1 | 0 | 1 | **5** |
| **basico** | $9.99 | hasta 100 | 1 | 1 | 3 | **150** |
| **avanzado** | $19.99 | ilimitados | hasta 2–3 | hasta 5–10 | 15 | **500** |

- **Sentinela "ilimitado"**: `max_products = 0` significa ilimitado (no -1 ni flag aparte).
- **Billing**: mensual / trimestral (10% off) / anual (15% off). Stripe multi-moneda con FX
  de display; los **edge functions de Stripe son la fuente de verdad** del cobro.
- **Add-on de catálogo**: ~$3.99–$5.99/mes; los slots extra son **a nivel de cuenta** (owner),
  agregados a través de cualquier catálogo, pero se acreditan al owner.
- **Expiración / gracia**: el plan expira solo si el flag está seteado **Y** la fecha
  `plan_expires_at` ya pasó (período prepago = flag seteado pero fecha futura). Banner de
  aviso a ≤6 días; período de **gracia ~3 días** post-expiración antes de bajar a gratis.
- **Venezuela paga en USD** aunque la moneda del tenant sea VES.

## Créditos de IA  (detalle en `features/ai-credits.md`)

- Asignación mensual por plan: **gratis 5 · básico 150 · avanzado 500** (subido desde 100/400
  el 2026-06-21). El allowance del owner = **mayor plan** entre sus catálogos.
- **Costo por acción**: quitar fondo 1 · segmentar 1 · generar imagen 3 · mejorar texto 1 ·
  borrador a mano **0** (es canvas local, no pasa por edge function).
- Dos cubetas: **mensual** (se resetea, `reset_due_ai_credits` cron diario) + **comprada**
  (no vence). Se gasta primero la mensual.
- Si cambian los allowances: actualizar el CASE en `ensure_ai_credits`,
  `reset_due_ai_credits`, `sync_ai_credits_on_plan_change` (DB) + `plans.ts` (app) +
  `Pricing.tsx` (landing). Al subirlos, bumpear a los existentes (sumar la diferencia al saldo).

## Packs de crédito (compra)

- Compra de **cantidad libre** con descuento por volumen (precio **autoritativo en el
  servidor**, `create-credit-checkout`). Base **$0.019/crédito** (`BASE_CENTS_PER_CREDIT=1.9`),
  min 100, max 5000, paso 50. Descuentos: ≥300→5% · ≥600→6% · ≥1000→8% · ≥2000→10%.
- Stripe Checkout `mode:payment` con `price_data` inline (no hay productos pre-creados).
  Fulfillment por **verify-on-redirect** (`confirm-credit-purchase`, idempotente por
  `stripe_session_id`). No se tocó el `stripe-webhook` de suscripciones.

## Reportes semanales (email)

- Se envían **solo a planes pagos** (`plan_id IS DISTINCT FROM 'gratis'`) con el toggle
  `notify_weekly_report` ON (default ON). Hoy en prod = básico + avanzado (gratis excluido).
- ⚠️ El filtro es *"no gratis"* (no *"is pago"*): si un tenant queda con `plan_id = NULL` o
  un plan nuevo, se colaría. Hoy no hay NULLs. Cron domingos vía `send-weekly-report` (deployada,
  no en repo) → RPC `weekly_report_candidates` / `build_report_snapshot` / `weekly_report_recipients`.

## Roles y permisos de equipo

- Roles en `users_tenants.role`: **owner > admin > member**. Un team por tenant.
- Permisos granulares `module:action` (módulos: catalogo, ordenes, clientes, analiticas,
  tasas, productos, equipo, reportes; acciones: view/create/edit/delete/invite) en
  `team_member_permissions`. Owner tiene todo; member el subset asignado.
- `canInviteMore` = miembros aceptados < `maxTeamMembers` del plan.

## Verificación de correo

- **Estado actual: DESHABILITADA** (toggle "Confirm email" en Supabase = OFF) — la gente no
  confirmaba. Con OFF, el registro va directo al admin (comportamiento de siempre). El código
  de verificación queda intacto; re-activar = prender el toggle. Ver `features/auth-verification.md`.
