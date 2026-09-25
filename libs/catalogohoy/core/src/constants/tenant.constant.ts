/**
 * Default tenant slug for local development.
 * Change this value to test with different tenants.
 */
export const DEV_TENANT_SLUG = 'catalogohoy';

/**
 * Slugs que ven el canal "Instagram y Facebook" (Conectar Meta, CAT-64/65)
 * mientras dura el App Review de Meta: sin Advanced Access, el OAuth solo
 * funciona para cuentas con rol en la app. `null` = visible para todos
 * (cambiar al aprobar la revisión). 'catalogohoy' = tenant 6, demo del revisor.
 */
export const META_CHANNEL_ALLOWED_SLUGS: string[] | null = ['catalogohoy'];

/**
 * Reserved subdomains that redirect to other apps instead of loading a catalog.
 * Key: subdomain slug, Value: target URL.
 */
export const RESERVED_SUBDOMAIN_REDIRECTS: Record<string, string> = {
  internal: 'https://catalogohoy-internal.vercel.app',
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
