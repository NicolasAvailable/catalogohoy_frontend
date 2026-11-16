/** Vendedor de la tienda (CAT-87). No tiene acceso al panel: solo un link
 *  propio `/v/<slug>` del catálogo y un % de comisión. */
export interface Seller {
  id: string;
  name: string;
  slug: string;
  whatsapp: string | null;
  email: string | null;
  commissionPct: number;
  isActive: boolean;
  createdAt: string;
}

export interface SellerInput {
  name: string;
  slug: string;
  whatsapp: string | null;
  email: string | null;
  commissionPct: number;
  isActive: boolean;
}

/** Fila del reporte de comisiones de un vendedor en el mes. */
export interface SellerCommissionRow {
  sellerId: string;
  name: string;
  slug: string;
  whatsapp: string | null;
  commissionPct: number;
  isActive: boolean;
  completedOrders: number;
  sales: number;
  commission: number;
  commissionPaid: number;
  commissionPending: number;
  openOrders: number;
  openSales: number;
}

/** Orden atribuida a un vendedor (detalle del reporte). */
export interface SellerOrder {
  id: number;
  orderNumber: number | null;
  customer: string;
  createdAt: string;
  status: string;
  base: number;
  pct: number;
  commission: number;
  paidAt: string | null;
}

/** Vendedores permitidos por plan (espejo de `_seller_limit` en la DB). */
export function sellerLimitForPlan(planId: string | null | undefined): number {
  switch (planId) {
    case 'pro':
      return 3;
    case 'avanzado':
      return 10;
    case 'enterprise':
      return Infinity;
    default:
      return 0;
  }
}

/** "Juan Pérez" → "juan-perez" (válido para el link /v/<slug>). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export const SELLER_SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;

/** Link del vendedor a partir de la URL pública del catálogo. Respeta el
 *  `?slug=` que se usa en local y los dominios propios. */
export function sellerLink(catalogUrl: string, slug: string): string {
  if (!catalogUrl) return `/v/${slug}`;
  try {
    const url = new URL(catalogUrl);
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/v/${slug}`;
    return url.toString();
  } catch {
    return `${catalogUrl.replace(/\/+$/, '')}/v/${slug}`;
  }
}

/** Base de la comisión: lo pagado sin el envío (igual que la DB). */
export function commissionBase(totalUsd: number, shippingFee: number, manualCommission: number): number {
  return Math.max(0, (totalUsd || 0) - (shippingFee || 0) + (manualCommission || 0));
}

/** Mes actual 'YYYY-MM' en hora local. */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Suma `delta` meses a 'YYYY-MM'. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return currentMonth(new Date(y, m - 1 + delta, 1));
}

/** Rango [from, to) del mes en hora LOCAL, como ISO (timestamptz). */
export function monthRangeIso(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  return {
    from: new Date(y, m - 1, 1).toISOString(),
    to: new Date(y, m, 1).toISOString(),
  };
}

/** Mensaje legible para errores de la DB. */
export function sellerErrorMessage(message: string): string {
  if (message.includes('seller_limit_reached')) return 'Llegaste al límite de vendedores de tu plan.';
  if (message.includes('sellers_tenant_id_slug_key') || message.includes('duplicate key'))
    return 'Ya tienes un vendedor con ese link. Elige otro.';
  if (message.includes('not_allowed') || message.includes('row-level security'))
    return 'No tienes permiso para hacer esto.';
  return 'Algo salió mal. Intenta de nuevo.';
}
