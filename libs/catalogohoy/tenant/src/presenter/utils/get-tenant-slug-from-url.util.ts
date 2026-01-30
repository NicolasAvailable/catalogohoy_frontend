import { DEV_TENANT_SLUG, isDevMode } from '@catalogohoy/core';

export const getTenantSlugFromUrl = (): string | null => {
  // For local development, use the centralized dev slug
  if (isDevMode()) {
    // Check if there's a slug in the URL path (e.g., /catalogohoy)
    const pathSlug = window.location.pathname.split('/')[1];
    return pathSlug || DEV_TENANT_SLUG;
  }

  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length < 3) return null;
  return parts[0];
};
