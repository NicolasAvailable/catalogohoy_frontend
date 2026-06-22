# Features — Auth y verificación de correo

> App `authentication` (puerto 5200, `auth.catalogohoy.com`, deploya de la rama `authentication`).
> Lib `@catalogohoy/auth`.

## Flujo de auth

- Login / signup (email + Google OAuth popup) / forgot-password / reset-password / accept-invite /
  **confirm-email**. Rutas en `apps/authentication/.../app.routes.ts`.
- **Cross-app**: tras autenticarse, `_buildRedirectUrl(slug, customDomain)` arma la URL del admin
  (`http://localhost:4200/admin?<authConfigKey>=<value>` en dev; `https://<host>/admin?...` en prod)
  y hace `window.location.href = url`. La app catalogohoy lee ese param para establecer la sesión
  cross-app.
- El rediseño de login/signup (card en desktop + hero con mockups reales) vive en la rama
  `authentication` (commits `feat(auth): card…` / `hero…`).

## Verificación de correo — ESTADO ACTUAL: **DESHABILITADA**

- El toggle **"Confirm email"** en Supabase Auth está **OFF** (la gente no confirmaba). Con OFF,
  `signUp()` devuelve sesión al instante → el registro va **directo al admin**, como siempre.
- El **código de verificación queda intacto**; re-activar = prender el toggle de nuevo (sin deploy).

### Cómo funciona el gate (clave para entender por qué OFF = comportamiento viejo)

`authentication.service.ts → signup()`:
```ts
const { data, error } = await this.client.auth.signUp({ ..., options: {
  emailRedirectTo: `${window.location.origin}/confirm-email`, data: {...} } });
if (error) return E.left(...);
if (!data.session) return E.right(SIGNUP_CONFIRM_EMAIL);   // ← SOLO si NO hay sesión (toggle ON)
// ... original: get_my_tenant → _buildRedirectUrl → admin
```
- Toggle **OFF** → `data.session` presente → el `if` es falso → corre el flujo original → admin.
  La pantalla "Revisá tu correo" es **imposible** de ver con el toggle OFF.
- Toggle **ON** → `signUp` no devuelve sesión → retorna el sentinel `SIGNUP_CONFIRM_EMAIL` → el
  componente `signup` muestra el overlay **"Revisá tu correo"** (layout de 2 paneles).
- `emailRedirectTo` solo se usa cuando se manda un correo de verificación (toggle ON); con OFF es inerte.

### Callback de confirmación (cuando esté ON)

- Componente `ConfirmEmail` + ruta `/confirm-email`: lee los tokens del **fragment** de la URL
  (implicit flow, igual que reset-password) → `confirmEmail()` (`setSession` + `get_my_tenant` +
  `_buildRedirectUrl`) → redirige al admin del tenant.
- Plantilla del email: `supabase/templates/confirm-signup.html` (pegar en Dashboard → Auth →
  Email Templates → "Confirm signup"). Usa `{{ .ConfirmationURL }}`.

### Grandfathering

- Al activar la verificación, los usuarios existentes **ya están confirmados** (todos tienen
  `email_confirmed_at`), así que el toggle ON solo afecta a registros **nuevos**; nadie queda bloqueado.

### Re-activar (checklist)

1. Pegar la plantilla en Confirm signup.
2. Agregar `https://auth.catalogohoy.com/confirm-email` (y `http://localhost:5200/confirm-email`)
   a las Redirect URLs (ya configuradas).
3. Prender "Confirm email" (en ese orden, para que ningún registro nuevo quede sin poder confirmar).

## Notificación a Discord de lead nuevo

- Debe llegar **solo cuando el usuario verifica su correo**. Resuelto con dos triggers
  (ver `integrations.md` / `database.md`): `notify_new_lead` (en `users_tenants`, solo si el correo
  ya está confirmado → cubre toggle OFF) + `notify_lead_on_email_confirm` (en `auth.users` al
  confirmar → cubre toggle ON). Nunca duplica ni pierde, según el estado del toggle.
