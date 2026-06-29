import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getTenantSlugFromUrl, TenantStore } from '@catalogohoy/tenant';

/** Catálogos que tienen habilitado el módulo de Chats / CRM de WhatsApp
 *  mientras Meta revisa la app (App Review). El resto de los comerciantes no
 *  ve el módulo ni puede entrar a sus rutas. Para abrirlo a más catálogos (o
 *  a todos) editar esta lista. */
export const CHAT_ENABLED_SLUGS = ['catalogohoy'];

/** Permite entrar a `/admin/chat/**` solo si el catálogo actual está en la
 *  allowlist; si no, redirige al inicio del admin. */
export const chatEnabledGuard: CanActivateFn = () => {
  const slug = getTenantSlugFromUrl() || inject(TenantStore).tenantSlug() || '';
  if (CHAT_ENABLED_SLUGS.includes(slug)) return true;
  return inject(Router).createUrlTree(['/admin']);
};
