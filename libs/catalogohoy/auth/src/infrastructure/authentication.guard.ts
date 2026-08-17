import { isDevMode } from '@angular/core';
import { type CanActivateFn } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';

export const authenticationGuard: CanActivateFn = async () => {
  if (isDevMode()) return true;

  const supabase = SupabaseClientProvider.getInstance();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    return true;
  } else {
    // returnUrl: tras el login volvemos al deep link que gatilló el guard
    // (p.ej. /admin/orders?order=ID del botón "Ver pedido" de WhatsApp).
    // El login solo lo honra si apunta al host del tenant logueado.
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `https://auth.catalogohoy.com/login?returnUrl=${returnUrl}`;
    return false;
  }
};
