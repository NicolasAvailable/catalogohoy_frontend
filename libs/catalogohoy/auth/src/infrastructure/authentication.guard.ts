import { inject, isDevMode } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { isNativeApp, SupabaseClientProvider } from '@catalogohoy/core';

export const authenticationGuard: CanActivateFn = async () => {
  if (isDevMode()) return true;

  // inject() debe llamarse antes del primer await (contexto de inyección).
  const router = inject(Router);

  const supabase = SupabaseClientProvider.getInstance();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    return true;
  }

  // App nativa: login in-app; no sacamos al usuario del shell hacia la web.
  if (isNativeApp()) {
    return router.parseUrl('/login');
  }

  // returnUrl: tras el login volvemos al deep link que gatilló el guard
  // (p.ej. /admin/orders?order=ID del botón "Ver pedido" de WhatsApp).
  // El login solo lo honra si apunta al host del tenant logueado.
  const returnUrl = encodeURIComponent(window.location.href);
  window.location.href = `https://auth.catalogohoy.com/login?returnUrl=${returnUrl}`;
  return false;
};
