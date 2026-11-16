import { totalStockOf } from './product-stock';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = (x: any) => x;

describe('totalStockOf', () => {
  it('sums variant stock when every variant has its own stock (no sizes)', () => {
    const item = p({
      stock: '25',
      isSized: false,
      isVariant: true,
      variants: [
        { stock: 0, sizes: [] },
        { stock: 23, sizes: [] },
      ],
    });
    expect(totalStockOf(item)).toBe(23);
  });

  it('falls back to product stock when a variant has no stock (unlimited)', () => {
    const item = p({
      stock: '49',
      isSized: false,
      isVariant: true,
      variants: [
        { stock: null, sizes: [] },
        { stock: 5, sizes: [] },
      ],
    });
    expect(totalStockOf(item)).toBe(49);
  });

  it('keeps product stock for simple products', () => {
    expect(
      totalStockOf(
        p({ stock: '7', isSized: false, isVariant: false, variants: [] }),
      ),
    ).toBe(7);
    expect(
      totalStockOf(
        p({ stock: null, isSized: false, isVariant: false, variants: [] }),
      ),
    ).toBeNull();
  });
});
