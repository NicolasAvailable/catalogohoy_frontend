import { Capacitor } from '@capacitor/core';

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
 * true cuando la app corre dentro del shell nativo (Capacitor, iOS/Android),
 * false en el navegador. En nativo el hostname es `localhost`, por eso NO se
 * puede usar `isDevMode()` para distinguir dev-vs-prod ni derivar el slug del
 * subdominio: el slug se resuelve del perfil tras el login (ver getNativeSlug).
 */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** true solo en el shell nativo de iOS (p.ej. para mostrar Sign in with Apple). */
export const isIosApp = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

const NATIVE_SLUG_STORAGE_KEY = 'slug';
let cachedNativeSlug: string | null = null;

/**
 * Slug del tenant activo en la app nativa. Se setea tras el login (o al arrancar
 * con sesión existente) y lo consume `getTenantSlugFromUrl()`. Persiste en
 * localStorage para sobrevivir el cold-start antes de que el bootstrap lo cachee.
 */
export const setNativeSlug = (slug: string): void => {
  cachedNativeSlug = slug;
  try {
    localStorage.setItem(NATIVE_SLUG_STORAGE_KEY, slug);
  } catch {
    /* storage no disponible */
  }
};

export const getNativeSlug = (): string | null => {
  if (cachedNativeSlug) return cachedNativeSlug;
  try {
    cachedNativeSlug = localStorage.getItem(NATIVE_SLUG_STORAGE_KEY);
  } catch {
    cachedNativeSlug = null;
  }
  return cachedNativeSlug;
};

export const clearNativeSlug = (): void => {
  cachedNativeSlug = null;
  try {
    localStorage.removeItem(NATIVE_SLUG_STORAGE_KEY);
  } catch {
    /* noop */
  }
};

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
