import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { getTenantSlugFromUrl, TenantStore } from '@catalogohoy/tenant';

/** Override interno: catálogos con el módulo de Chats habilitado sin importar
 *  su plan (nuestro tenant demo + pilotos que se agreguen a mano). */
export const CHAT_ENABLED_SLUGS = ['catalogohoy'];

/** Planes con acceso al CRM de WhatsApp (decisión 2026-07-21: Pro y Avanzado;
 *  enterprise incluido por estar por encima). El sidebar usa la misma lista
 *  para mostrar/ocultar el menú. */
export const CHAT_ENABLED_PLANS = ['pro', 'avanzado', 'enterprise'];

/** Permite entrar a `/admin/chat/**` si el catálogo está en la allowlist
 *  interna O su plan lo incluye (y no está vencido). Se consulta la DB directo
 *  porque el guard puede correr antes de que el PlanStore cargue. */
export const chatEnabledGuard: CanActivateFn = async () => {
  // inject() debe llamarse sincrónicamente (antes de cualquier await).
  const tenantStore = inject(TenantStore);
  const router = inject(Router);

  const slug = getTenantSlugFromUrl() || tenantStore.tenantSlug() || '';
  if (CHAT_ENABLED_SLUGS.includes(slug)) return true;
  if (!slug) return router.createUrlTree(['/admin']);

  const { data } = await SupabaseClientProvider.getInstance()
    .from('tenants')
    .select('plan_id, plan_expired')
    .eq('slug', slug)
    .maybeSingle();

  const allowed =
    !!data &&
    !data.plan_expired &&
    CHAT_ENABLED_PLANS.includes(data.plan_id ?? '');
  return allowed ? true : router.createUrlTree(['/admin']);
};
