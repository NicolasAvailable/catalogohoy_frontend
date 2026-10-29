if (!('randomUUID' in (globalThis.crypto || {}))) {
  let counter = 0;
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...(globalThis.crypto || {}),
      randomUUID: () => `uuid-${++counter}`,
    },
    configurable: true,
  });
}

jest.mock('@catalogohoy/core', () => ({
  SupabaseClientProvider: {
    getInstance: () => ({ from: jest.fn() }),
    create: () => ({}),
  },
}));

import { CategoryList } from '@catalogohoy/category';
import { Product, ProductPrimitives } from '@catalogohoy/product';
import { CartItem } from './cart-item.model';
import { revalidateCart } from './cart-revalidation';

function product(overrides: Partial<ProductPrimitives> = {}): Product {
  return Product.fromPrimitives({
    id: '10',
    name: 'Franela',
    description: 'Algodón',
    price: 20,
    pricePromotional: 0,
    photos: ['p.jpg'],
    stock: null,
    categoryList: CategoryList.from([]),
    authUserId: 'u',
    createdAt: '',
    sku: null,
    productionCost: null,
    position: 0,
    isWholesale: false,
    wholesaleTiers: [],
    isSoldOut: false,
    isHidden: false,
    isSized: false,
    sizes: [],
    ...overrides,
  });
}

function line(
  o: Partial<{
    productId: string;
    price: number;
    quantity: number;
    size: string | null;
    variantId: string | null;
    variantName: string | null;
    tierTitle: string | null;
    addons: { id: string; name: string; price: number }[];
  }> = {}
): CartItem {
  return new CartItem(
    o.productId ?? '10',
    'Franela',
    'Algodón',
    o.price ?? 20,
    'p.jpg',
    o.quantity ?? 1,
    o.tierTitle ?? null,
    undefined,
    null,
    o.size ?? null,
    o.variantId ?? null,
    o.variantName ?? null,
    o.addons ?? []
  );
}

const opts = { divisasPromo: false };

describe('revalidateCart', () => {
  it('leaves an up-to-date cart untouched', () => {
    const r = revalidateCart([line({ quantity: 2 })], [product()], opts);
    expect(r.changes).toEqual([]);
    expect(r.items[0].quantity).toBe(2);
    expect(r.items[0].price).toBe(20);
  });

  it('keeps deleted and hidden products as unavailable lines', () => {
    const r = revalidateCart(
      [line(), line({ productId: '11' })],
      [product({ id: '11', isHidden: true })],
      opts
    );
    expect(r.items.map((i) => i.unavailable)).toEqual([true, true]);
    expect(r.items.map((i) => i.total)).toEqual([0, 0]);
    expect(r.changes.map((c) => c.kind)).toEqual(['removed', 'removed']);
  });

  it('updates a changed price (promo included) and reports it', () => {
    const r = revalidateCart(
      [line()],
      [product({ price: 25, pricePromotional: 22 })],
      opts
    );
    expect(r.items[0].price).toBe(22);
    expect(r.changes).toEqual([
      expect.objectContaining({
        kind: 'price_changed',
        oldPrice: 20,
        newPrice: 22,
      }),
    ]);
  });

  it('charges the normal price for divisas-promo catalogs', () => {
    const r = revalidateCart(
      [line()],
      [product({ price: 20, pricePromotional: 15 })],
      {
        divisasPromo: true,
      }
    );
    expect(r.changes).toEqual([]);
    expect(r.items[0].divisasPrice).toBe(15);
  });

  it('marks sold-out products unavailable and caps quantity to the stock left', () => {
    const soldOut = revalidateCart(
      [line()],
      [product({ isSoldOut: true })],
      opts
    );
    expect(soldOut.items[0].unavailable).toBe(true);
    expect(soldOut.changes[0].kind).toBe('sold_out');

    const zero = revalidateCart([line()], [product({ stock: '0' })], opts);
    expect(zero.changes[0].kind).toBe('sold_out');

    const capped = revalidateCart(
      [line({ quantity: 5 })],
      [product({ stock: '3' })],
      opts
    );
    expect(capped.items[0].quantity).toBe(3);
    expect(capped.items[0].maxStock).toBe(3);
    expect(capped.changes[0]).toEqual(
      expect.objectContaining({
        kind: 'stock_reduced',
        oldQuantity: 5,
        newQuantity: 3,
      })
    );
  });

  it('shares the stock of a size across lines with different addons', () => {
    const p = product({
      isSized: true,
      sizes: [{ name: 'M', stock: 3 }],
      addons: [{ id: 'a', name: 'Caja', price: 2 }],
    });
    const r = revalidateCart(
      [
        line({ size: 'M', quantity: 2 }),
        line({
          size: 'M',
          quantity: 2,
          price: 22,
          addons: [{ id: 'a', name: 'Caja', price: 2 }],
        }),
      ],
      [p],
      opts
    );
    expect(r.items.map((i) => i.quantity)).toEqual([2, 1]);
    expect(r.changes.map((c) => c.kind)).toEqual(['stock_reduced']);
  });

  it('marks lines whose size or variant no longer exists as unavailable', () => {
    const r = revalidateCart(
      [line({ size: 'XL' }), line({ variantId: 'v1', variantName: 'Rojo' })],
      [
        product({
          isSized: true,
          sizes: [{ name: 'M', stock: null }],
          isVariant: true,
          variants: [
            {
              id: 'v1',
              name: 'Rojo',
              price: 20,
              originalPrice: 0,
              photos: [],
              stock: null,
              sizes: [],
              isHidden: true,
            },
          ],
        }),
      ],
      opts
    );
    expect(r.items.map((i) => i.unavailable)).toEqual([true, true]);
    expect(r.items.map((i) => i.total)).toEqual([0, 0]);
    expect(r.changes.map((c) => c.kind)).toEqual(['removed', 'removed']);
  });

  it('reprices variants and wholesale tiers', () => {
    const r = revalidateCart(
      [
        line({ variantId: 'v1', variantName: 'Azul', price: 30 }),
        line({ tierTitle: '6+', price: 15 }),
      ],
      [
        product({
          isVariant: true,
          variants: [
            {
              id: 'v1',
              name: 'Azul',
              price: 32,
              originalPrice: 0,
              photos: [],
              stock: 4,
              sizes: [],
            },
          ],
          wholesaleTiers: [{ title: '6+', price: 15 }],
        }),
      ],
      opts
    );
    expect(r.items.map((i) => i.price)).toEqual([32, 15]);
    expect(r.items[0].maxStock).toBe(4);
    expect(r.changes.map((c) => c.kind)).toEqual(['price_changed']);
  });

  it('reports an unavailable line only once and re-enables it when stock returns', () => {
    const first = revalidateCart([line()], [product({ stock: '0' })], opts);
    const again = revalidateCart(first.items, [product({ stock: '0' })], opts);
    expect(again.changes).toEqual([]);
    expect(again.items[0].unavailable).toBe(true);

    const back = revalidateCart(again.items, [product({ stock: '5' })], opts);
    expect(back.items[0].unavailable).toBe(false);
    expect(back.items[0].total).toBe(20);
  });
});
