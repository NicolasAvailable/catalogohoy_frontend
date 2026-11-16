import { Product } from './product.model';

/** Total units available for a product. Sized products keep their units per
 *  size (`products.stock` stays NULL), so this sums the sizes — and the sizes
 *  of each variant when every variant has its own sizes — instead of reading
 *  the NULL product stock as unlimited. Variants without sizes that all
 *  carry their own stock are summed too (sales deduct from the variant).
 *  `null` = unlimited (no stock set, or any size left without a quantity). Used by the admin list's Stock column
 *  and the public catalog's "Quedan N" label. */
export function totalStockOf(item: Product): number | null {
  const sumSizes = (sizes: { stock: number | string | null }[]) =>
    sizes.some((s) => s.stock === null || s.stock === '')
      ? null
      : sizes.reduce((acc, s) => acc + Number(s.stock || 0), 0);

  if (item.isSized && item.sizes?.length) {
    return sumSizes(item.sizes);
  }
  const variants = item.isVariant ? item.variants ?? [] : [];
  if (variants.length && variants.every((v) => v.sizes?.length)) {
    let total = 0;
    for (const v of variants) {
      const sub = sumSizes(v.sizes);
      if (sub === null) return null;
      total += sub;
    }
    return total;
  }
  // Variantes sin tallas con stock propio (ej. "BARRA POSA PIE" → JAGUAR /
  // CG-150 H): la venta descuenta el stock de la VARIANTE, no el del producto
  // (`decrement_product_stock`), así que el total real es la suma de las
  // variantes. Si alguna variante no tiene stock (ilimitado) se sigue usando
  // el stock del producto, que es lo que descuenta la RPC en ese caso.
  if (
    variants.length &&
    variants.every(
      (v) =>
        !v.sizes?.length &&
        v.stock !== null &&
        v.stock !== undefined &&
        (v.stock as unknown) !== ''
    )
  ) {
    return variants.reduce((acc, v) => acc + Number(v.stock || 0), 0);
  }
  return item.stock === null || item.stock === '' ? null : Number(item.stock);
}
