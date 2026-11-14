// "Ocultar productos agotados": getProducts filtra en el servidor los
// productos simples/variantes en 0 y quita después los de tallas que suman 0.

jest.mock('@catalogohoy/core', () => {
  const fakeClient = { from: jest.fn(), rpc: jest.fn() };
  return {
    SupabaseClientProvider: {
      getInstance: () => fakeClient,
      create: () => fakeClient,
    },
    __fakeClient: fakeClient,
  };
});

import { EcommerceService } from './ecommerce.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __fakeClient } = jest.requireMock('@catalogohoy/core') as {
  __fakeClient: { from: jest.Mock };
};

const row = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `P${id}`,
  price: 1,
  stock: 5,
  photos: [],
  product_categories: [],
  is_sold_out: false,
  is_hidden: false,
  is_sized: false,
  sizes: [],
  is_variant: false,
  variants: [],
  ...extra,
});

function buildChain(result: { data: unknown[]; count: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  for (const m of ['select', 'eq', 'or', 'order', 'range', 'filter']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ ...result, error: null }).then(resolve);
  return chain;
}

describe('EcommerceService.getProducts — hideSoldOut', () => {
  beforeEach(() => __fakeClient.from.mockReset());

  it('does not filter when the option is off', async () => {
    const chain = buildChain({ data: [row(1)], count: 1 });
    __fakeClient.from.mockReturnValue(chain);

    const res = await new EcommerceService().getProducts(
      's', undefined, undefined, undefined, 1, 20, '10'
    );

    expect(chain.or).not.toHaveBeenCalled();
    expect(chain.eq).not.toHaveBeenCalledWith('is_sold_out', false);
    expect(res.isRight() && res.value.hasMore).toBeUndefined();
  });

  it('filters stock 0 / sold out in the query when the option is on', async () => {
    const chain = buildChain({ data: [row(1)], count: 1 });
    __fakeClient.from.mockReturnValue(chain);

    await new EcommerceService().getProducts(
      's', undefined, undefined, undefined, 1, 20, '10', undefined, true
    );

    expect(chain.eq).toHaveBeenCalledWith('is_sold_out', false);
    expect(chain.or).toHaveBeenCalledWith('stock.is.null,stock.gt.0');
  });

  it('drops sized products whose sizes add up to 0 and keeps paging right', async () => {
    const data = [
      row(1),
      row(2, { stock: null, is_sized: true, sizes: [{ name: 'M', stock: 0 }] }),
      row(3, { stock: null, is_sized: true, sizes: [{ name: 'M', stock: 2 }] }),
      row(4, { stock: null }), // sin stock definido = ilimitado
    ];
    __fakeClient.from.mockReturnValue(buildChain({ data, count: 30 }));

    const res = await new EcommerceService().getProducts(
      's', undefined, undefined, undefined, 1, 4, '10', undefined, true
    );

    expect(res.isRight()).toBe(true);
    if (res.isRight()) {
      expect(res.value.productList.products.map((p) => String(p.id))).toEqual([
        '1', '3', '4',
      ]);
      expect(res.value.totalCount).toBe(29);
      expect(res.value.hasMore).toBe(true);
    }
  });
});
