# Reporte semanal por email — Plan de implementación

> Estado: **planificado**, listo para ejecutar. El MCP de Supabase estaba caído
> al cerrar el plan, así que la parte de DB/edge-function se aplica cuando vuelva.
> Decisiones asumidas (ajustables) marcadas con 🔧.

## Contexto

Los comerciantes no tienen una visión consolidada de cómo les fue en la semana.
Queremos enviar **cada domingo** un email con el resumen de la semana (lunes→domingo):
ventas, órdenes, top productos, vistas del catálogo, etc. Es un nudge de
engagement + valor percibido del producto.

## Alcance v1 — métricas (🔧 default recomendado)

**A) Ventas y órdenes** (de `build_report_snapshot`)
- Ventas totales (moneda de referencia + Bs si VE) · N° de órdenes + desglose por
  estado · ticket promedio · ventas por día (mini-gráfico L→D) · **top 5 productos**
  (cantidad + ingresos) · métodos de pago · mejor día.

**B) Comparativa vs semana anterior** (llamar `build_report_snapshot` 2 veces)
- Ventas ▲▼% · órdenes ▲▼% · "titular" automático (ej. *"📈 +23% en ventas"*).

**C) Clientes + alertas** (RPC `get_customers_by_tenant` + queries extra)
- Clientes nuevos / recurrentes · productos **agotados** · órdenes **pendientes** ·
  entregas programadas para la semana próxima (`delivery_date`).

**D) Tráfico del catálogo** (PostHog — el comerciante lo pidió explícitamente)
- Visitas · visitantes únicos · **tasa de conversión** (órdenes ÷ visitantes) ·
  producto más visto · día/hora pico.
- ⚠️ Es la pieza más compleja: vive **solo en PostHog** (no hay tabla en Supabase).
  Se consulta vía HogQL por `properties.tenant_slug` para el rango de la semana.

**Destinatarios** (🔧): **dueño + miembros del equipo con permiso `ordenes:view`**
(igual que los avisos de pedidos por email).

**Envío** (🔧): domingo ~23:00 UTC (≈ tarde/noche LATAM), cubriendo lunes 00:00 →
domingo 23:59 de la semana que cierra.

## Arquitectura (máximo reuso de lo existente)

```
pg_cron (domingo) ──► net.http_post + x-webhook-secret ──► edge fn `send-weekly-report`
   │
   └─ por cada tenant con notify_weekly_report = true:
        1. recipients = RPC weekly_report_recipients(tenant_id)   [NUEVO]
        2. snapshot   = RPC build_report_snapshot(tenant, semana) [YA EXISTE]
           + build_report_snapshot(tenant, semana_anterior) para deltas
        3. clientes   = RPC get_customers_by_tenant(...)          [YA EXISTE]
        4. tráfico    = HogQL a PostHog por tenant_slug (bloque D)
        5. email      = render HTML + Resend (noreply@catalogohoy.com)
```

Patrones a copiar (de `supabase/functions/send-plan-expiry-warning` y sus migraciones):
- **Cron + secret**: `cron.schedule('send-weekly-report-sundays', '0 23 * * 0', …net.http_post(url, headers x-webhook-secret, body)…)`. Mirror de `20260510_plan_expiry_candidates_rpc_and_cron.sql`.
- **Email Resend**: mismo `fetch('https://api.resend.com/emails', { from: 'CatalogoHoy <noreply@catalogohoy.com>', to, subject, html, text })`. Reusar el template HTML (header con logo + `theme_color`, tabla de datos, botón CTA, footer).
- **Idempotencia**: tabla `weekly_report_sends` (tenant_id, week_start, recipient_email UNIQUE) para no duplicar — igual que `tenant_expiry_warnings`.
- **Recipients RPC**: como `plan_expiry_candidates` pero UNION de `users_tenants` (owner) + `team_members`/`team_member_permissions` (equipo con `ordenes:view`). Respeta `tenant_ecommerce_config.notify_weekly_report`.

## Pasos de implementación

**1. Migración SQL** (`supabase/migrations/<fecha>_weekly_report.sql`)
- `ALTER TABLE tenant_ecommerce_config ADD COLUMN notify_weekly_report BOOLEAN DEFAULT true;`
- Tabla `weekly_report_sends` (idempotencia) + RLS.
- RPC `weekly_report_recipients(p_tenant_id)` → emails (owner + equipo con `ordenes:view`).
- RPC `weekly_report_tenants()` → tenants con `notify_weekly_report = true` (candidatos).
- `cron.schedule('send-weekly-report-sundays', '0 23 * * 0', …)`.

**2. Edge function** `send-weekly-report` (verify_jwt=false, x-webhook-secret)
- Recorre los tenants candidatos; por cada uno arma snapshot (A/B), clientes (C),
  tráfico (D, PostHog), renderiza el email y lo manda por Resend a cada destinatario;
  registra en `weekly_report_sends`.

**3. Frontend — toggle en la tab "Notificaciones"** (`libs/catalogohoy/ecommerce-config`)
- `ecommerce-config.service.ts`: agregar `notify_weekly_report` al SELECT + mapeo
  `notifyWeeklyReport` + `updateConfig`.
- `ecommerce-config.ts`: signal `draftNotifyWeeklyReport`, sync + `getChangedFields`.
- `ecommerce-config.html`: card nuevo en la tab Notificaciones (patrón del card
  "Avisos de pedidos por email", con `ui-toggle`), default ON.
- Modelo `EcommerceConfig` (domain) + `DEFAULT`: agregar `notifyWeeklyReport`.

**4. (Opcional) Vista previa / "Enviar prueba ahora"** — botón que invoca la edge
function para el tenant actual, para que el dueño vea cómo queda sin esperar al domingo.

## Reuso confirmado (existe en prod)
- ✅ RPC `build_report_snapshot(tenant_id, period_start, period_end)` → bloque A.
- ✅ RPC `get_customers_by_tenant` → bloque C.
- ✅ `team_members` + `team_member_permissions` + `users_tenants` → destinatarios.
- ✅ Resend (`RESEND_API_KEY`) + template HTML en `send-plan-expiry-warning`.
- ✅ Patrón cron en `20260510_plan_expiry_candidates_rpc_and_cron.sql`.
- ✅ PostHog HogQL (`POSTHOG_PERSONAL_KEY`) en `supabase/functions/posthog-analytics`.

## Verificación
1. Aplicar migración (dry-run BEGIN…ROLLBACK contra prod primero).
2. Deploy `send-weekly-report`; invocarla manual con el x-webhook-secret y un tenant
   con datos (ej. tenant 6 / un catálogo con órdenes) → confirmar que llega el email
   y que los números cuadran con la vista de Reportes.
3. Verificar idempotencia (correrla 2 veces no duplica).
4. Verificar el toggle: apagarlo en un tenant → no recibe; encenderlo → recibe.
5. Programar el cron y validar el `cron.job_run_details` del primer domingo.

## Notas / decisiones a confirmar
- 🔧 Métricas v1: incluí A+B+C+D (D = vistas, que pediste). Si querés dejar D para
  fase 2 (menos dependencia de PostHog), se quita fácil.
- 🔧 Destinatarios: dueño + equipo con `ordenes:view`. Alternativa: solo dueño.
- 🔧 Horario: domingo 23:00 UTC. Ajustable (incluso configurable por tenant si se quiere).
- El email del reporte debe tener link a **Reportes** del admin y un footer para
  desactivar (apunta a la tab Notificaciones).
