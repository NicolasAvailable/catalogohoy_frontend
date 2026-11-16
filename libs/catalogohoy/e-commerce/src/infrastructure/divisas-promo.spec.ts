// jsdom's Crypto doesn't expose randomUUID by default — CartItem uses it.
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

jest.mock('ngx-sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

jest.mock('@catalogohoy/core', () => ({
  SupabaseClientProvider: {
    getInstance: () => ({ from: jest.fn() }),
    create: () => ({}),
  },
}));

import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Product, ProductPrimitives } from '@catalogohoy/product';
import { CategoryList } from '@catalogohoy/category';
import {
  CartItem,
  divisasPriceOf,
  isDivisasPaymentMethod,
  usesDivisasPromo,
} from '../domain';
import { CartStore } from './cart.store';
import { EcommerceStore } from './ecommerce.store';

const translocoTestingImports = [
  TranslocoTestingModule.forRoot({
    langs: {},
    translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
  }),
];

function buildProduct(overrides: Partial<ProductPrimitives> = {}): Product {
  return Product.fromPrimitives({
    id: 'product-1',
    name: 'Smartwatch',
    description: '',
    price: 52.76,
    pricePromotional: 40,
    photos: [],
    stock: null,
    categoryList: CategoryList.from([]),
    authUserId: 'user-1',
    createdAt: new Date().toISOString(),
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

function setup(tenantId: number) {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: translocoTestingImports,
    providers: [
      { provide: EcommerceStore, useValue: { catalogInfo: () => ({ id: tenantId }) } },
    ],
  });
  return TestBed.inject(CartStore);
}

describe('divisas promo — domain', () => {
  it('only gates the listed catalogs', () => {
    expect(usesDivisasPromo(614)).toBe(true);
    expect(usesDivisasPromo(1022)).toBe(false);
    expect(usesDivisasPromo(null)).toBe(false);
  });

  it('recognises cash / crypto payment methods', () => {
    expect(isDivisasPaymentMethod('Efectivo')).toBe(true);
    expect(isDivisasPaymentMethod('Binance')).toBe(true);
    expect(isDivisasPaymentMethod('USDT (TRC20)')).toBe(true);
    expect(isDivisasPaymentMethod('Pago movil')).toBe(false);
    expect(isDivisasPaymentMethod('Transferencia')).toBe(false);
    expect(isDivisasPaymentMethod('')).toBe(false);
  });

  it('returns the promo price only when it is a real discount', () => {
    expect(divisasPriceOf({ price: 52.76, pricePromotional: 40 })).toBe(40);
    expect(divisasPriceOf({ price: 10, pricePromotional: 0 })).toBeNull();
    expect(divisasPriceOf({ price: 10, pricePromotional: 12 })).toBeNull();
  });

  it('CartItem computes the savings and keeps them across quantity changes', () => {
    const item = new CartItem('p', 'n', '', 52.76, '', 1, null, undefined, null, null, null, null, [], null, 40);
    expect(item.divisasSavings).toBe(12.76);
    expect(item.incrementQuantity().divisasSavings).toBe(25.52);
    const plain = new CartItem('p', 'n', '', 20, '', 2);
    expect(plain.divisasSavings).toBe(0);
  });
});

describe('divisas promo — CartStore', () => {
  afterEach(() => localStorage.clear());

  it('gated catalog: charges the normal price and tracks the divisas savings', () => {
    const store = setup(614);
    store.addProduct(buildProduct());
    store.addProduct(buildProduct());
    expect(store.items()[0].price).toBe(52.76);
    expect(store.totalPrice()).toBe(105.52);
    expect(store.divisasSavings()).toBe(25.52);
  });

  it('gated catalog: addons ride on top of both prices', () => {
    const store = setup(614);
    store.addProduct(buildProduct(), {
      addons: [{ id: 'a1', name: 'Caja', price: 2 }],
    });
    const [item] = store.items();
    expect(item.price).toBe(54.76);
    expect(item.divisasPrice).toBe(42);
  });

  it('gated catalog: variants keep their own price and no divisas price', () => {
    const store = setup(614);
    store.addProduct(buildProduct(), {
      variant: { id: 'v1', name: 'Negro', price: 50, originalPrice: 0, photos: [], stock: null, sizes: [] },
    });
    expect(store.items()[0].price).toBe(50);
    expect(store.divisasSavings()).toBe(0);
  });

  it('other catalogs: unchanged — the promo price is charged', () => {
    const store = setup(1022);
    store.addProduct(buildProduct());
    expect(store.items()[0].price).toBe(40);
    expect(store.divisasSavings()).toBe(0);
  });
});
