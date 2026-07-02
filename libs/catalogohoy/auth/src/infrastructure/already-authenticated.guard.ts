import { inject } from '@angular/core';
import { type CanActivateFn } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { AuthenticationService } from './authentication.service';

/**
 * Guard para las pantallas de login/signup del app de autenticación.
 *
 * Si el usuario YA tiene una sesión VÁLIDA (llegó a auth.catalogohoy.com desde
 * la landing, o porque se acuerda la URL), no le pedimos volver a loguearse:
 * resolvemos su tenant y lo mandamos directo al `/admin`. Reutiliza EXACTAMENTE
 * el mismo redirect que un login fresco (`getLoginRedirectUrl` → `get_my_tenant`
 * + URL con el token por query param), así que el pase de sesión cross-app es
 * idéntico al del flujo normal.
 *
 * IMPORTANTE: validamos con `getUser()` (pega al server), NO con `getSession()`.
 * `getSession()` solo lee el localStorage y devuelve la sesión aunque el token
 * esté vencido/roto/revocado (p. ej. tras cerrar sesión en otro origen) — eso
 * hacía que redirigiéramos al admin con un token muerto y cayera en la vista
 * "no-access". Si `getUser()` falla, limpiamos el resto de sesión local y
 * mostramos el login normal.
 *
 * Corre también en dev para poder probarlo (auth en :5200 → redirige a
 * localhost:4200/admin).
 */
export const alreadyAuthenticatedGuard: CanActivateFn = async () => {
  // inject() debe llamarse ANTES del primer await (contexto de inyección).
  const service = inject(AuthenticationService);
  const supabase = SupabaseClientProvider.getInstance();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    // Token roto/vencido/revocado o sin sesión → limpiar cualquier resto local
    // (para no quedar en un loop) y mostrar el login normal.
    if (error) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    return true;
  }

  const redirect = await service.getLoginRedirectUrl();
  return redirect.fold(
    // Sin tenant u otro error: mostramos la pantalla normal (no bloqueamos).
    () => true,
    (url) => {
      window.location.href = url;
      return false;
    }
  );
};
