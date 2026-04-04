import { DEV_TENANT_SLUG, isDevMode } from '@catalogohoy/core';

let cachedCustomDomainSlug: string | null = null;

export const setCustomDomainSlug = (slug: string): void => {
  cachedCustomDomainSlug = slug;
};

export const isCustomDomain = (): boolean => {
  const host = window.location.hostname.replace(/^www\./, '');
  return !host.endsWith('catalogohoy.com') && host !== 'localhost' && host !== '127.0.0.1';
};

export const getTenantSlugFromUrl = (): string | null => {
  if (isDevMode()) {
    const pathSlug = window.location.pathname.split('/')[1];
    return pathSlug || DEV_TENANT_SLUG;
  }

  if (cachedCustomDomainSlug) {
    return cachedCustomDomainSlug;
  }

  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length < 3) return null;
  return parts[0];
};
