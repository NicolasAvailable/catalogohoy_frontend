import { computed, inject } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  findCountryByCode,
  findCurrencyByCode,
  SUPPORTED_CURRENCIES,
} from '../domain';

// -----------------------------------------------------------------------------
// TenantCurrencyStore
//
// Lightweight, read-only-ish store that exposes the active tenant's currency
// info (symbol, ISO code, country). Read by any admin UI that needs to render
// amounts in the tenant's local currency (dashboard metrics, order lists,
// order create form, etc).
//
// Cache strategy — hit localStorage first, DB last:
//   1. `load(tenantId)` reads `tenant_currency_{tenantId}` from localStorage.
//      If present → state populates synchronously, no round-trip.
//   2. On cache miss → fetch from Supabase, then write back to localStorage.
//   3. When the editor persists a currency change via
//      `EcommerceConfigStore.saveCurrencyConfig()` / `saveTenantCountry()`,
//      it calls `TenantCurrencyStore.setCurrency()` — which updates both
//      the in-memory signals and localStorage.
//
// The DB is the source of truth; localStorage is a read-through cache.
// -----------------------------------------------------------------------------

type State = {
  localCode: string;
  localSymbol: string;
  countryCode: string | null;
  isLoaded: boolean;
  isLoading: boolean;
};

const initialState: State = {
  localCode: 'USD',
  localSymbol: '$',
  countryCode: null,
  isLoaded: false,
  isLoading: false,
};

const STORAGE_PREFIX = 'tenant_currency_';

interface CachedCurrency {
  localCode: string;
  localSymbol: string;
  countryCode: string | null;
}

function cacheKey(tenantId: number | string): string {
  return `${STORAGE_PREFIX}${tenantId}`;
}

function readCache(tenantId: number | string): CachedCurrency | null {
  try {
    const raw = localStorage.getItem(cacheKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCurrency;
    if (!parsed.localCode || !parsed.localSymbol) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(tenantId: number | string, value: CachedCurrency): void {
  try {
    localStorage.setItem(cacheKey(tenantId), JSON.stringify(value));
  } catch {
    /* storage quota / incognito — fall back to memory-only state */
  }
}

function clearCache(tenantId: number | string): void {
  try {
    localStorage.removeItem(cacheKey(tenantId));
  } catch {
    /* noop */
  }
}

export const TenantCurrencyStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isVenezuela: computed(() => store.countryCode() === 'VE'),
  })),
  withMethods((store) => {
    const client = SupabaseClientProvider.getInstance();

    return {
      async load(tenantId: number | string): Promise<void> {
        if (store.isLoaded() || store.isLoading()) return;

        // 1. Cache-first: populate state synchronously from localStorage.
        //    All downstream consumers render immediately with no DB call.
        const cached = readCache(tenantId);
        if (cached) {
          patchState(store, {
            localCode: cached.localCode,
            localSymbol: cached.localSymbol,
            countryCode: cached.countryCode,
            isLoaded: true,
          });
          return;
        }

        // 2. Cache miss → fetch from DB, write back to cache.
        patchState(store, { isLoading: true });
        try {
          const [tenantRes, currencyRes] = await Promise.all([
            client
              .from('tenants')
              .select('country_code')
              .eq('id', tenantId)
              .maybeSingle(),
            client
              .from('tenant_currency_config')
              .select('product_currency, currency_symbol')
              .eq('tenant_id', Number(tenantId))
              .maybeSingle(),
          ]);

          const countryCode =
            (tenantRes.data as { country_code?: string } | null)?.country_code ?? null;

          let localCode = 'USD';
          let localSymbol = '$';

          if (currencyRes.data) {
            localCode = currencyRes.data.product_currency ?? 'USD';
            localSymbol =
              currencyRes.data.currency_symbol ??
              findCurrencyByCode(localCode)?.symbol ??
              '$';
          } else {
            // No currency_config row — derive from country defaults
            const country = findCountryByCode(countryCode);
            if (country) {
              localCode = country.defaultCurrency;
              localSymbol =
                SUPPORTED_CURRENCIES.find((c) => c.code === localCode)?.symbol ?? '$';
            }
          }

          patchState(store, {
            countryCode,
            localCode,
            localSymbol,
            isLoaded: true,
            isLoading: false,
          });
          writeCache(tenantId, { localCode, localSymbol, countryCode });
        } catch {
          patchState(store, { isLoading: false, isLoaded: true });
        }
      },

      /**
       * Called by the catalog editor after the user persists a currency or
       * country change. Updates both the in-memory signals and the
       * localStorage cache so every admin view sees the new symbol on the
       * next render — no reload required.
       */
      setCurrency(
        tenantId: number | string,
        payload: Partial<CachedCurrency>
      ): void {
        const next: CachedCurrency = {
          localCode: payload.localCode ?? store.localCode(),
          localSymbol: payload.localSymbol ?? store.localSymbol(),
          countryCode: payload.countryCode ?? store.countryCode(),
        };
        patchState(store, {
          localCode: next.localCode,
          localSymbol: next.localSymbol,
          countryCode: next.countryCode,
          isLoaded: true,
        });
        writeCache(tenantId, next);
      },

      /** Clear the cache (e.g., on logout or tenant switch). */
      invalidate(tenantId?: number | string): void {
        if (tenantId != null) clearCache(tenantId);
        patchState(store, initialState);
      },

      reset(): void {
        patchState(store, initialState);
      },
    };
  })
);
