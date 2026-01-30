export const getTenantSlugFromUrl = (): string | null => {
  const host = window.location.hostname;

  // For local development, use a test slug
  if (host === 'localhost' || host === '127.0.0.1') {
    // Check if there's a slug in the URL path (e.g., /catalogohoy)
    const pathSlug = window.location.pathname.split('/')[1];
    return pathSlug || 'catalogohoy';
  }

  const parts = host.split('.');
  if (parts.length < 3) return null;
  return parts[0];
};
