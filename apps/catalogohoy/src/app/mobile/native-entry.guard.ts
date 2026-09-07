import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import {
  isNativeApp,
  setNativeSlug,
  SupabaseClientProvider,
} from '@catalogohoy/core';

/**
 * Punto de entrada del shell NATIVO. En web es un no-op (deja cargar el
 * storefront público de la raíz `''`). En la app nativa la raíz no tiene sentido
 * (no hay slug en la URL), así que redirige:
 *   - con sesión → resuelve el slug del tenant, lo cachea y va a `/admin`.
 *   - sin sesión → `/login` (login in-app).
 */
export const nativeEntryGuard: CanActivateFn = async () => {
  if (!isNativeApp()) return true;

  // inject() antes del primer await (contexto de inyección).
  const router = inject(Router);
  const supabase = SupabaseClientProvider.getInstance();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return router.parseUrl('/login');

  const { data: rows } = await supabase.rpc('get_my_tenant');
  const slug = (rows?.[0]?.slug as string | undefined) ?? null;
  if (slug) {
    setNativeSlug(slug);
    return router.parseUrl('/admin');
  }

  // Logueado pero sin catálogo asociado → login (muestra el aviso de registro).
  return router.parseUrl('/login');
};
