/** Vendedor del link /v/<slug> (CAT-87), tal como lo ve el catálogo público
 *  (sin el % de comisión). */
export interface PublicSeller {
  id: string;
  name: string;
  slug: string;
  whatsapp: string | null;
}

/** Días que dura la atribución: si el cliente vuelve dentro de ese plazo
 *  (aunque entre por el link normal), la venta sigue siendo del vendedor. */
export const SELLER_ATTRIBUTION_DAYS = 30;

const KEY_PREFIX = 'ch-seller-';

/** Slug del vendedor en la URL: `/v/<slug>` o `?v=<slug>`. */
export function sellerSlugFromUrl(href: string): string | null {
  try {
    const url = new URL(href);
    const match = url.pathname.match(/^\/v\/([^/?#]+)\/?$/i);
    const raw = match ? decodeURIComponent(match[1]) : url.searchParams.get('v');
    const slug = (raw ?? '').trim().toLowerCase();
    return /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

/** Último vendedor guardado para esta tienda (si no venció). */
export function readStoredSellerSlug(tenantId: string | number, now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + tenantId);
    if (!raw) return null;
    const data = JSON.parse(raw) as { slug?: string; exp?: number };
    if (!data.slug || !data.exp || data.exp < now) {
      localStorage.removeItem(KEY_PREFIX + tenantId);
      return null;
    }
    return data.slug;
  } catch {
    return null;
  }
}

/** Guarda el vendedor (último link gana) por SELLER_ATTRIBUTION_DAYS. */
export function storeSellerSlug(tenantId: string | number, slug: string, now = Date.now()): void {
  try {
    localStorage.setItem(
      KEY_PREFIX + tenantId,
      JSON.stringify({ slug, exp: now + SELLER_ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000 })
    );
  } catch {
    /* sin storage: la atribución dura solo esta visita */
  }
}

export function clearStoredSeller(tenantId: string | number): void {
  try {
    localStorage.removeItem(KEY_PREFIX + tenantId);
  } catch {
    /* noop */
  }
}
