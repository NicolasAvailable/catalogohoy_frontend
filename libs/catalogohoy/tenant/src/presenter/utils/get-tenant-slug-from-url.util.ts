import { DEV_TENANT_SLUG, isDevMode } from '@catalogohoy/core';

let cachedCustomDomainSlug: string | null = null;

export const setCustomDomainSlug = (slug: string): void => {
  cachedCustomDomainSlug = slug;
};

export const isCustomDomain = (): boolean => {
  const host = window.location.hostname.replace(/^www\./, '');
  return !host.endsWith('catalogohoy.com') && host !== 'localhost' && host !== '127.0.0.1';
};

/** Public-catalog route segments that are NOT tenant slugs. In dev the slug is
 *  taken from the first path segment, so these must fall back to the dev tenant
 *  instead of being treated as a slug (e.g. /checkout, /order/:id/invoice). */
const RESERVED_PATH_SEGMENTS = ['checkout', 'order', 'product'];

export const getTenantSlugFromUrl = (): string | null => {
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
