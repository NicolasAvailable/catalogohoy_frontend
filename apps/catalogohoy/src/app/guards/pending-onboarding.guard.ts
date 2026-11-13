import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { onboardingDoneKey } from '@catalogohoy/onboarding';

/** Slug temporal que crea el trigger de signup (handle_new_user). */
const TEMP_SLUG = /^(mi-)?tienda-/;

/**
 * Si el wizard de onboarding quedó a medias Y la tienda sigue con el slug
 * temporal (`mi-tienda-N`), al entrar al admin se retoma el wizard.
 *
 * Por qué: el link definitivo se aplica al TERMINAR el wizard. En la app
 * nativa (y en web al volver directo a /admin con la sesión guardada) quien
 * cerraba la app después del paso 1 caía directo al admin, el wizard nunca
 * terminaba y el catálogo quedaba para siempre en `mi-tienda-N` aunque ya
 * tuviera nombre. Solo afecta a tiendas con slug temporal: los catálogos con
 * link real entran al admin como siempre.
 *
 * Best-effort: ante cualquier error deja pasar al admin.
 */
export const pendingOnboardingGuard: CanActivateFn = async () => {
  const router = inject(Router);
  try {
    const client = SupabaseClientProvider.getInstance();
    const { data: rows } = await client.rpc('get_my_tenant');
    const tenant = (rows as { id?: number; slug?: string }[] | null)?.[0];
    if (!tenant?.id || !tenant.slug || !TEMP_SLUG.test(tenant.slug)) return true;

    // El propio wizard redirige al admin si ve este flag: evitamos el bucle.
    try {
      if (localStorage.getItem(onboardingDoneKey(tenant.id)) === '1') return true;
    } catch {
      /* ignore private-mode */
    }

    const { data: step, error } = await client.rpc('get_my_onboarding_step');
    if (error || typeof step !== 'number') return true;
    return router.parseUrl('/onboarding');
  } catch {
    return true;
  }
};
