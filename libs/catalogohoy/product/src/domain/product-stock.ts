import { Product } from './product.model';

/** Total units available for a product. Sized products keep their units per
 *  size (`products.stock` stays NULL), so this sums the sizes — and the sizes
 *  of each variant when every variant has its own sizes — instead of reading
 *  the NULL product stock as unlimited. `null` = unlimited (no stock set, or
 *  any size left without a quantity). Used by the admin list's Stock column
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
  return item.stock === null || item.stock === '' ? null : Number(item.stock);
}
