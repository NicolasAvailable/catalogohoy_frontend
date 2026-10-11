import { Order } from './order';

/**
 * Nombre del archivo del PDF de la factura. Los clientes identifican la factura
 * por el comprador, no por el número de orden.
 *
 * - Por defecto (todas las tiendas): solo el nombre del cliente → `Juan Pérez.pdf`.
 * - Moto Fox (allowlist): nombre + teléfono (sin código de país) → `Juan Pérez-4121234567.pdf`.
 * - Si el cliente tiene varias órdenes, se numeran a partir de la segunda para
 *   que los archivos no se pisen → `Juan Pérez.pdf`, `Juan Pérez (2).pdf`, …
 * - Sin nombre de cliente, conserva el esquema anterior `orden/recibo-<n>`.
 */

/** Tiendas cuyo archivo de factura incluye el teléfono del cliente concatenado
 *  al nombre (sin el código de país). Pedido puntual de Distribuidora Moto Fox. */
export const INVOICE_PHONE_TENANT_IDS: readonly number[] = [
  2421, // Distribuidora Moto Fox
];

/** Código de país a recortar del teléfono para el nombre del archivo
 *  (Moto Fox es de Venezuela → +58). */
const COUNTRY_CODE = '58';

export function invoiceFilenameUsesPhone(
  tenantId: number | null | undefined
): boolean {
  return tenantId != null && INVOICE_PHONE_TENANT_IDS.includes(tenantId);
}

/** Quita caracteres inválidos para un nombre de archivo y colapsa espacios. */
function sanitizeName(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Teléfono en solo dígitos, sin el código de país. */
function localPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.startsWith(COUNTRY_CODE)
    ? digits.slice(COUNTRY_CODE.length)
    : digits;
}

/**
 * Construye el nombre del archivo (con extensión `.pdf`).
 *
 * @param seq  Ordinal 1-based de esta orden entre las del mismo cliente. La
 *   primera queda con el nombre limpio; de la segunda en adelante agrega ` (N)`.
 */
export function buildInvoiceFilename(
  order: Pick<Order, 'tenantId' | 'name' | 'phone' | 'orderNumber' | 'id'>,
  opts: { isReceipt?: boolean; seq?: number } = {}
): string {
  const orderRef = order.orderNumber ?? order.id;
  const name = sanitizeName(order.name ?? '');

  // Sin nombre no hay con qué identificar la factura → esquema anterior.
  if (!name) {
    return `${opts.isReceipt ? 'recibo' : 'orden'}-${orderRef}.pdf`;
  }

  let base = name;
  if (invoiceFilenameUsesPhone(order.tenantId)) {
    const ph = localPhone(order.phone ?? '');
    if (ph) base = `${name}-${ph}`;
  }

  const suffix = opts.seq && opts.seq > 1 ? ` (${opts.seq})` : '';
  return `${base}${suffix}.pdf`;
}
