export const getTenantSlugFromUrl = (): string | null => {
  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length < 3) return null;
  return parts[0];
};
