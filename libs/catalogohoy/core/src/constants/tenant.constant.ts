/**
 * Default tenant slug for local development.
 * Change this value to test with different tenants.
 */
export const DEV_TENANT_SLUG = 'a1-caraudio';

/**
 * Reserved subdomains that redirect to other apps instead of loading a catalog.
 * Key: subdomain slug, Value: target URL.
 */
export const RESERVED_SUBDOMAIN_REDIRECTS: Record<string, string> = {
  internal: 'https://internal.catalogohoy.com',
};

/**
 * Check if we're running in development mode
 */
export const isDevMode = (): boolean => {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
};

/**
 * Get the tenant slug from URL or use default for development
 */
export const getTenantSlug = (): string => {
  if (isDevMode()) {
    return DEV_TENANT_SLUG;
  }
  // In production, extract slug from subdomain
  const hostname = window.location.hostname;
  const subdomain = hostname.split('.')[0];
  return subdomain;
};
