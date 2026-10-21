/**
 * Gate por catálogo para la "promo en divisas". Por defecto, cuando un producto
 * tiene precio promocional, la vitrina tacha el precio normal y cobra el
 * promocional.
 *
 * Para los tenants de esta lista el precio promocional es SOLO para quien paga
 * en divisas (efectivo) o USDT: la vitrina muestra el precio normal SIN tachar
 * (en la moneda de referencia y en Bs) y aparte el precio en divisas. El
 * carrito cobra el precio normal y, en el checkout, al elegir un método de
 * pago en divisas se aplica la diferencia como descuento (mismo snapshot
 * `payment_adjustment` que el resto de ajustes, así admin/PDF lo itemizan).
 *
 * Beta privada por pedido puntual. Para abrirlo a más catálogos, agregá su
 * `tenant_id`.
 */
export const DIVISAS_PROMO_TENANT_IDS: readonly number[] = [
  614, // Stendencia
];

/** True cuando el catálogo usa la promo en divisas. */
export function usesDivisasPromo(tenantId: number | null | undefined): boolean {
  return tenantId != null && DIVISAS_PROMO_TENANT_IDS.includes(Number(tenantId));
}

/** Métodos de pago que cuentan como "en divisas": efectivo y cripto/USDT. */
const DIVISAS_METHOD_PATTERN =
  /efectivo|cash|divisa|d[oó]lar|usdt|binance|cripto|crypto|zelle|paypal/i;

export function isDivisasPaymentMethod(name: string | null | undefined): boolean {
  return !!name && DIVISAS_METHOD_PATTERN.test(name);
}

/** Precio en divisas de un producto: el promocional cuando es menor que el
 *  normal; `null` si no hay promo válida. */
export function divisasPriceOf(product: {
  price: number;
  pricePromotional: number;
}): number | null {
  const promo = Number(product.pricePromotional) || 0;
  return promo > 0 && promo < Number(product.price) ? promo : null;
}
