// TenantCurrencyStore lives in @catalogohoy/ecommerce-config, which has no
// jest infrastructure of its own. We co-locate the spec in e-commerce since
// that lib already consumes the store and has jest configured.

jest.mock('@catalogohoy/core', () => ({
  SupabaseClientProvider: {
    getInstance: jest.fn(() => ({ from: jest.fn() })),
  },
}));

import { TestBed } from '@angular/core/testing';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';

type SupabaseSingleResult<T> = { data: T | null };

// Build a mock for `client.from('tenants').select(..).eq(..).maybeSingle()`
// and `client.from('tenant_currency_config').select(..).eq(..).maybeSingle()`.
function mockSupabase(
  tenantResult: SupabaseSingleResult<{ country_code?: string | null }>,
  currencyResult: SupabaseSingleResult<{
    product_currency?: string;
    currency_symbol?: string;
  }>
) {
  const build = (result: unknown) => ({
    select: () => ({
      eq: () => ({ maybeSingle: () => Promise.resolve(result) }),
    }),
  });
  return {
    from: jest.fn((table: string) => {
      if (table === 'tenants') return build(tenantResult);
      return build(currencyResult);
    }),
  };
}

describe('TenantCurrencyStore', () => {
  let store: InstanceType<typeof TenantCurrencyStore>;
  let client: ReturnType<typeof mockSupabase>;

  beforeEach(() => {
    localStorage.clear();
    client = mockSupabase({ data: null }, { data: null });
    (SupabaseClientProvider.getInstance as jest.Mock).mockReturnValue(client);

    TestBed.configureTestingModule({});
    store = TestBed.inject(TenantCurrencyStore);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initial state', () => {
    it('boots with USD defaults', () => {
      expect(store.localCode()).toBe('USD');
      expect(store.localSymbol()).toBe('$');
      expect(store.countryCode()).toBeNull();
      expect(store.isLoaded()).toBe(false);
      expect(store.isVenezuela()).toBe(false);
    });
  });

  describe('load — localStorage cache (fast path)', () => {
    it('populates state synchronously from cache without hitting Supabase', async () => {
      localStorage.setItem(
        'tenant_currency_42',
        JSON.stringify({
          localCode: 'BRL',
          localSymbol: 'R$',
          countryCode: 'BR',
        })
      );

      await store.load(42);

      expect(store.localCode()).toBe('BRL');
      expect(store.localSymbol()).toBe('R$');
      expect(store.countryCode()).toBe('BR');
      expect(store.isLoaded()).toBe(true);
      expect(client.from).not.toHaveBeenCalled();
    });

    it('ignores corrupted cache JSON and falls through to DB fetch', async () => {
      localStorage.setItem('tenant_currency_42', '{not json');

      await store.load(42);

      expect(client.from).toHaveBeenCalled();
    });

    it('treats missing localCode in cache as invalid and refetches', async () => {
      localStorage.setItem(
        'tenant_currency_42',
        JSON.stringify({ localSymbol: '$', countryCode: 'US' })
      );

      await store.load(42);

      expect(client.from).toHaveBeenCalled();
    });
  });

  describe('load — DB fetch (cache miss)', () => {
    it('derives currency from country defaults when no currency_config row exists', async () => {
      client = mockSupabase({ data: { country_code: 'BR' } }, { data: null });
      (SupabaseClientProvider.getInstance as jest.Mock).mockReturnValue(client);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      store = TestBed.inject(TenantCurrencyStore);

      await store.load(42);

      expect(store.countryCode()).toBe('BR');
      expect(store.localCode()).toBe('BRL');
      expect(store.localSymbol()).toBe('R$');
      expect(store.isLoaded()).toBe(true);
    });

    it('uses the persisted currency_config row over country defaults', async () => {
      client = mockSupabase(
        { data: { country_code: 'VE' } },
        {
          data: {
            product_currency: 'VES',
            currency_symbol: 'Bs.',
          },
        }
      );
      (SupabaseClientProvider.getInstance as jest.Mock).mockReturnValue(client);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      store = TestBed.inject(TenantCurrencyStore);

      await store.load(42);

      expect(store.localCode()).toBe('VES');
      expect(store.localSymbol()).toBe('Bs.');
      expect(store.isVenezuela()).toBe(true);
    });

    it('writes the result back to localStorage so the next load hits the cache', async () => {
      client = mockSupabase({ data: { country_code: 'MX' } }, { data: null });
      (SupabaseClientProvider.getInstance as jest.Mock).mockReturnValue(client);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      store = TestBed.inject(TenantCurrencyStore);

      await store.load(42);

      const cached = JSON.parse(localStorage.getItem('tenant_currency_42')!);
      expect(cached).toEqual({
        localCode: 'MXN',
        localSymbol: '$',
        countryCode: 'MX',
      });
    });

    it('ignores DB errors gracefully (marks loaded but keeps defaults)', async () => {
      const throwingClient = {
        from: jest.fn((_table: string) => {
          throw new Error('network down');
        }),
      };
      (SupabaseClientProvider.getInstance as jest.Mock).mockReturnValue(
        throwingClient
      );

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      store = TestBed.inject(TenantCurrencyStore);

      await store.load(42);

      expect(store.isLoaded()).toBe(true);
      expect(store.localCode()).toBe('USD');
    });
  });

  describe('guard rails', () => {
    it('skips re-load once already loaded', async () => {
      localStorage.setItem(
        'tenant_currency_42',
        JSON.stringify({ localCode: 'BRL', localSymbol: 'R$', countryCode: 'BR' })
      );
      await store.load(42);
      await store.load(42);
      await store.load(42);
      expect(client.from).not.toHaveBeenCalled();
    });
  });

  describe('setCurrency', () => {
    it('updates signals and rewrites localStorage atomically', () => {
      store.setCurrency(99, {
        localCode: 'PEN',
        localSymbol: 'S/',
        countryCode: 'PE',
      });

      expect(store.localCode()).toBe('PEN');
      expect(store.localSymbol()).toBe('S/');
      expect(store.countryCode()).toBe('PE');
      expect(store.isLoaded()).toBe(true);

      const cached = JSON.parse(localStorage.getItem('tenant_currency_99')!);
      expect(cached.localCode).toBe('PEN');
      expect(cached.localSymbol).toBe('S/');
      expect(cached.countryCode).toBe('PE');
    });

    it('merges partial payloads with existing state', () => {
      store.setCurrency(99, {
        localCode: 'PEN',
        localSymbol: 'S/',
        countryCode: 'PE',
      });
      store.setCurrency(99, { localSymbol: 'Soles' });
      expect(store.localCode()).toBe('PEN');
      expect(store.localSymbol()).toBe('Soles');
    });
  });

  describe('invalidate', () => {
    it('clears localStorage and resets the state', () => {
      store.setCurrency(99, {
        localCode: 'PEN',
        localSymbol: 'S/',
        countryCode: 'PE',
      });
      expect(localStorage.getItem('tenant_currency_99')).not.toBeNull();

      store.invalidate(99);

      expect(localStorage.getItem('tenant_currency_99')).toBeNull();
      expect(store.localCode()).toBe('USD');
      expect(store.isLoaded()).toBe(false);
    });

    it('resets in-memory state when invoked without a tenant id', () => {
      store.setCurrency(99, {
        localCode: 'PEN',
        localSymbol: 'S/',
        countryCode: 'PE',
      });
      store.invalidate();
      expect(store.localCode()).toBe('USD');
      // localStorage is preserved since we didn't know which tenant to clear.
      expect(localStorage.getItem('tenant_currency_99')).not.toBeNull();
    });
  });

  describe('localStorage robustness (regression for quota errors)', () => {
    it('does not throw when localStorage.setItem rejects (quota / incognito)', () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('QuotaExceeded');
      });

      expect(() =>
        store.setCurrency(99, {
          localCode: 'PEN',
          localSymbol: 'S/',
          countryCode: 'PE',
        })
      ).not.toThrow();
      expect(store.localCode()).toBe('PEN');

      Storage.prototype.setItem = original;
    });
  });
});
