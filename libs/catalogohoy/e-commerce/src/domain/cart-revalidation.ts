import { Product } from '@catalogohoy/product';
import { CartItem } from './cart-item.model';
import { divisasPriceOf } from './divisas-promo';

/** Qué le pasó a una línea del carrito al revalidarla contra el servidor. */
export type CartChangeKind =
  | 'removed' // el producto se eliminó, se ocultó o ya no tiene esa variante/talla/tramo
  | 'sold_out' // se agotó
  | 'stock_reduced' // quedan menos unidades de las que había en el carrito
  | 'price_changed'; // cambió el precio unitario

export interface CartChange {
  kind: CartChangeKind;
  /** Nombre de la línea tal como la veía el cliente (con variante/talla). */
  name: string;
  oldPrice?: number;
  newPrice?: number;
  oldQuantity?: number;
  newQuantity?: number;
}

export interface CartRevalidation {
  items: CartItem[];
  changes: CartChange[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function lineLabel(item: CartItem): string {
  const extra = [item.variantName, item.size].filter(Boolean).join(' · ');
  return extra ? `${item.name} (${extra})` : item.name;
}

/**
 * Recalcula el carrito guardado (localStorage) con los datos ACTUALES de los
 * productos: el cliente pudo agregar algo hace días y desde entonces cambió el
 * precio, se agotó o se eliminó. Misma lógica de precio/stock que
 * `CartStore.addProduct` para que una línea recién agregada no "cambie".
 *
 * `products` trae solo los productos que siguen existiendo en el catálogo; un
 * id ausente = eliminado.
 */
export function revalidateCart(
  items: CartItem[],
  products: Product[],
  options: { divisasPromo: boolean },
): CartRevalidation {
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const changes: CartChange[] = [];
  const result: CartItem[] = [];
  // Unidades ya asignadas por combinación producto+variante+talla: varias
  // líneas (p. ej. con distintos adicionales) comparten el mismo stock.
  const used = new Map<string, number>();

  for (const item of items) {
    const label = lineLabel(item);
    const product = byId.get(item.productId);
    if (!product || product.isHidden) {
      changes.push({ kind: 'removed', name: label });
      continue;
    }
    if (product.isSoldOut) {
      changes.push({ kind: 'sold_out', name: label });
      continue;
    }

    // --- Variante / talla y el stock que aplica (lo más específico) ---
    let stock: number | null;
    let variantPrice: number | null = null;
    let variantPhoto: string | undefined;
    if (item.variantId) {
      const variant = (product.variants ?? []).find(
        (v) => v.id === item.variantId,
      );
      if (!variant || variant.isHidden) {
        changes.push({ kind: 'removed', name: label });
        continue;
      }
      variantPrice = Number(variant.price) || 0;
      variantPhoto = variant.photos?.[0];
      if (item.size && variant.sizes?.length) {
        const size = variant.sizes.find((s) => s.name === item.size);
        if (!size) {
          changes.push({ kind: 'removed', name: label });
          continue;
        }
        stock = toStock(size.stock);
      } else {
        stock = toStock(variant.stock);
      }
    } else if (item.size && product.isSized) {
      const size = (product.sizes ?? []).find((s) => s.name === item.size);
      if (!size) {
        changes.push({ kind: 'removed', name: label });
        continue;
      }
      stock = toStock(size.stock);
    } else {
      stock = toStock(product.stock);
    }

    // --- Adicionales: los que ya no existen se quitan; el resto a precio actual ---
    const addons = item.addons
      .map((a) => (product.addons ?? []).find((pa) => pa.id === a.id))
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) => ({ id: a.id, name: a.name, price: Number(a.price) || 0 }));
    const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);

    // --- Precio unitario vigente ---
    let price: number;
    let divisasPrice: number | null = null;
    let name = item.name;
    if (item.tierTitle) {
      const tier = (product.wholesaleTiers ?? []).find(
        (t) => t.title === item.tierTitle,
      );
      if (!tier) {
        changes.push({ kind: 'removed', name: label });
        continue;
      }
      price = Number(tier.price) || 0;
      name = `${product.name} (${tier.title})`;
    } else if (variantPrice !== null) {
      price = variantPrice + addonsTotal;
      name = product.name;
    } else {
      const divisasBase = options.divisasPromo ? divisasPriceOf(product) : null;
      const promo = Number(product.pricePromotional) || 0;
      const base =
        divisasBase === null && promo > 0 ? promo : Number(product.price) || 0;
      price = base + addonsTotal;
      divisasPrice = divisasBase === null ? null : divisasBase + addonsTotal;
      name = product.name;
    }
    price = round2(price);

    // --- Cantidad dentro del stock disponible ---
    let quantity = item.quantity;
    if (stock !== null) {
      const key = `${item.productId}|${item.variantId ?? ''}|${item.size ?? ''}`;
      const left = Math.max(0, stock - (used.get(key) ?? 0));
      if (left <= 0) {
        changes.push({ kind: 'sold_out', name: label });
        continue;
      }
      if (quantity > left) {
        changes.push({
          kind: 'stock_reduced',
          name: label,
          oldQuantity: quantity,
          newQuantity: left,
        });
        quantity = left;
      }
      used.set(key, (used.get(key) ?? 0) + quantity);
    }

    if (Math.abs(price - item.price) > 0.009) {
      changes.push({
        kind: 'price_changed',
        name: label,
        oldPrice: item.price,
        newPrice: price,
      });
    }

    result.push(
      new CartItem(
        item.productId,
        name,
        product.description ?? item.description,
        price,
        (variantPhoto || product.photos?.[0]) ?? item.photo,
        quantity,
        item.tierTitle,
        item.id,
        product.sku ?? item.sku,
        item.size,
        item.variantId,
        item.variantName,
        addons,
        // Las líneas de mayoreo se topan por el stock del producto (como al agregar).
        item.tierTitle ? toStock(product.stock) : stock,
        divisasPrice,
      ),
    );
  }

  return { items: result, changes };
}

function toStock(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
