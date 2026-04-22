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

// ngx-sonner pulls in ESM only and isn't relevant for state — stub it.
jest.mock('ngx-sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@catalogohoy/core', () => ({
  SupabaseClientProvider: {
    getInstance: () => ({ from: jest.fn() }),
    create: () => ({}),
  },
}));

import { TestBed } from '@angular/core/testing';
import {
  Product,
  ProductPrimitives,
  WholesaleTier,
} from '@catalogohoy/product';
import { CategoryList } from '@catalogohoy/category';
import { toast } from 'ngx-sonner';
import { CartItem } from '../domain';
import { CartStore } from './cart.store';

const CART_KEY = 'catalogohoy_cart';

function buildProduct(overrides: Partial<ProductPrimitives> = {}): Product {
  return Product.fromPrimitives({
    id: 'product-1',
    name: 'Franela Negra',
    description: 'Algodón premium',
    price: 20,
    pricePromotional: 0,
    photos: ['https://img/franela.jpg'],
    stock: null,
    categoryList: CategoryList.from([]),
    authUserId: 'user-1',
    createdAt: new Date().toISOString(),
    sku: 'SKU-1',
    productionCost: null,
    position: 0,
    isWholesale: false,
    wholesaleTiers: [],
    isSoldOut: false,
    isHidden: false,
    ...overrides,
  });
}

describe('CartStore', () => {
  let store: InstanceType<typeof CartStore>;

  beforeEach(() => {
    localStorage.clear();
    (toast.error as jest.Mock).mockClear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(CartStore);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initial state', () => {
    it('boots empty', () => {
      expect(store.isEmpty()).toBe(true);
      expect(store.totalItems()).toBe(0);
      expect(store.totalPrice()).toBe(0);
      expect(store.items()).toEqual([]);
      expect(store.isOpen()).toBe(false);
    });
  });

  describe('addProduct', () => {
    it('adds a product and persists to localStorage', () => {
      store.addProduct(buildProduct());
      expect(store.totalItems()).toBe(1);
      expect(store.totalPrice()).toBe(20);
      const persisted = JSON.parse(localStorage.getItem(CART_KEY)!);
      expect(persisted).toHaveLength(1);
      expect(persisted[0].productId).toBe('product-1');
    });

    it('uses promotional price when present', () => {
      store.addProduct(buildProduct({ pricePromotional: 15 }));
      expect(store.totalPrice()).toBe(15);
    });

    it('increments quantity when the same product+tier is added twice', () => {
      store.addProduct(buildProduct());
      store.addProduct(buildProduct());
      expect(store.items()).toHaveLength(1);
      expect(store.totalItems()).toBe(2);
      expect(store.totalPrice()).toBe(40);
    });

    it('rejects adding when stock is 0 (shows toast)', () => {
      store.addProduct(buildProduct({ stock: '0' }));
      expect(store.isEmpty()).toBe(true);
      expect(toast.error).toHaveBeenCalledWith('Este producto está agotado');
    });

    it('rejects adding beyond available stock', () => {
      const p = buildProduct({ stock: '1' });
      store.addProduct(p);
      store.addProduct(p);
      expect(store.totalItems()).toBe(1);
      expect(toast.error).toHaveBeenCalledWith(
        'No hay más stock disponible de este producto'
      );
    });

    it('allows unlimited quantity when stock is null (no tracking)', () => {
      const p = buildProduct({ stock: null });
      store.addProduct(p);
      store.addProduct(p);
      store.addProduct(p);
      expect(store.totalItems()).toBe(3);
    });
  });

  describe('addWholesaleProduct', () => {
    const tier: WholesaleTier = { title: 'A partir de 30', price: 12 };

    it('adds a wholesale tier with tier title embedded in name', () => {
      store.addWholesaleProduct(buildProduct(), tier);
      const item = store.items()[0];
      expect(item.tierTitle).toBe('A partir de 30');
      expect(item.name).toBe('Franela Negra (A partir de 30)');
      expect(item.price).toBe(12);
    });

    it('treats different tiers of the same product as separate cart lines', () => {
      store.addWholesaleProduct(buildProduct(), tier);
      store.addWholesaleProduct(buildProduct(), { title: '50 piezas', price: 10 });
      expect(store.items()).toHaveLength(2);
      expect(store.totalItems()).toBe(2);
      expect(store.totalPrice()).toBe(22);
    });
  });

  describe('mutation methods', () => {
    it('increments and decrements items, removing at zero', () => {
      store.addProduct(buildProduct());
      const id = store.items()[0].id;

      store.incrementItem(id);
      expect(store.totalItems()).toBe(2);
      store.decrementItem(id);
      expect(store.totalItems()).toBe(1);
      store.decrementItem(id);
      expect(store.isEmpty()).toBe(true);
    });

    it('updateQuantity sets the exact count', () => {
      store.addProduct(buildProduct());
      const id = store.items()[0].id;
      store.updateQuantity(id, 5);
      expect(store.totalItems()).toBe(5);
      expect(store.totalPrice()).toBe(100);
    });

    it('updateQuantity with 0 removes the item', () => {
      store.addProduct(buildProduct());
      const id = store.items()[0].id;
      store.updateQuantity(id, 0);
      expect(store.isEmpty()).toBe(true);
    });

    it('removeItem takes the line out and updates storage', () => {
      store.addProduct(buildProduct());
      const id = store.items()[0].id;
      store.removeItem(id);
      expect(store.isEmpty()).toBe(true);
      expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([]);
    });

    it('clearCart empties everything', () => {
      store.addProduct(buildProduct());
      store.addProduct(buildProduct({ id: 'product-2' }));
      store.clearCart();
      expect(store.isEmpty()).toBe(true);
    });
  });

  describe('drawer state toggles', () => {
    it('openCart closes the checkout at the same time', () => {
      store.openCheckout();
      store.openCart();
      expect(store.isOpen()).toBe(true);
      expect(store.isCheckoutOpen()).toBe(false);
    });

    it('toggleCart flips the open flag', () => {
      expect(store.isOpen()).toBe(false);
      store.toggleCart();
      expect(store.isOpen()).toBe(true);
      store.toggleCart();
      expect(store.isOpen()).toBe(false);
    });

    it('openCheckout / closeCheckout manage the secondary drawer', () => {
      store.openCheckout();
      expect(store.isCheckoutOpen()).toBe(true);
      store.closeCheckout();
      expect(store.isCheckoutOpen()).toBe(false);
    });
  });

  describe('total rounding', () => {
    it('sums floating-point prices to two decimals without drift', () => {
      store.addProduct(buildProduct({ price: 0.1 }));
      store.addProduct(buildProduct({ price: 0.1 }));
      store.addProduct(buildProduct({ price: 0.1 }));
      // 0.1+0.1+0.1 = 0.30000000000000004 raw, must round to 0.3
      expect(store.totalPrice()).toBe(0.3);
    });
  });

  describe('persistence round-trip', () => {
    // `initialState` reads localStorage at module-load time, so to test
    // rehydration we have to seed the cache and re-import the module in an
    // isolated scope (TestBed.resetTestingModule alone keeps the cached
    // instance from the first inject).
    it('rehydrates a cart written by a previous session', () => {
      localStorage.setItem(
        CART_KEY,
        JSON.stringify([
          {
            id: 'item-id',
            productId: 'product-1',
            name: 'Franela',
            description: 'desc',
            price: 20,
            photo: 'url',
            quantity: 2,
            tierTitle: null,
          },
        ])
      );

      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { CartStore: FreshCartStore } = require('./cart.store');
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({});
        const rehydrated = TestBed.inject(FreshCartStore) as InstanceType<
          typeof CartStore
        >;
        expect(rehydrated.totalItems()).toBe(2);
        expect(rehydrated.totalPrice()).toBe(40);
        expect(rehydrated.items()[0].productId).toBe('product-1');
      });
    });

    it('boots empty when localStorage has corrupted JSON', () => {
      localStorage.setItem(CART_KEY, '{not-json');
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { CartStore: FreshCartStore } = require('./cart.store');
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({});
        const rehydrated = TestBed.inject(FreshCartStore) as InstanceType<
          typeof CartStore
        >;
        expect(rehydrated.isEmpty()).toBe(true);
      });
    });
  });
});
