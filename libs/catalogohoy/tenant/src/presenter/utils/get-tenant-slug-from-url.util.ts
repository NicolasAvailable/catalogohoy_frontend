import { DEV_TENANT_SLUG, isDevMode } from '@catalogohoy/core';

let cachedCustomDomainSlug: string | null = null;

export const setCustomDomainSlug = (slug: string): void => {
  cachedCustomDomainSlug = slug;
};

export const isCustomDomain = (): boolean => {
  const host = window.location.hostname.replace(/^www\./, '');
  return !host.endsWith('catalogohoy.com') && host !== 'localhost' && host !== '127.0.0.1';
};

/** Route segments that are NOT tenant slugs. In dev the slug is taken from the
 *  first path segment, so these must fall back to the dev tenant instead of
 *  being treated as a slug (e.g. /checkout, /order/:id/invoice, /admin/...). */
const RESERVED_PATH_SEGMENTS = ['checkout', 'order', 'product', 'admin'];

export const getTenantSlugFromUrl = (): string | null => {
  // Modo preview (iframe del editor de catálogo y del wizard de onboarding):
  // el tenant a mostrar es el slug que se pasó explícitamente, no el del host.
  // Solo aplica cuando `preview=true` está en la URL — un contexto que NUNCA
  // ocurre en el storefront público de un cliente real. En prod coincide con
  // el subdominio; en dev evita que el preview caiga al DEV_TENANT_SLUG y
  // muestre el catálogo demo en vez de la tienda que se está creando/editando.
  const params = new URLSearchParams(window.location.search);
  if (params.get('preview') === 'true') {
    const previewSlug = params.get('slug') || localStorage.getItem('slug');
    if (previewSlug) return previewSlug;
  }

  if (isDevMode()) {
    const pathSlug = window.location.pathname.split('/')[1];
    if (pathSlug && !RESERVED_PATH_SEGMENTS.includes(pathSlug)) return pathSlug;
    return DEV_TENANT_SLUG;
  }

  if (cachedCustomDomainSlug) {
    return cachedCustomDomainSlug;
  }

  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length < 3) return null;
  return parts[0];
};
