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
// Two currencies per tenant:
//   - LOCAL (product) currency  → `localCode` / `localSymbol`. The currency the
//     products are stored in. For Venezuela this is VES ('Bs.'); for everyone
//     else it equals the display currency.
//   - DISPLAY (reference) currency → `displayCode` / `displaySymbol`. The
//     currency order totals (`total_usd`) are expressed in and shown to the
//     user. For Venezuela the admin picks USD ('$') or EUR ('€'); for everyone
//     else it's the country's local currency (DOP 'RD$', MXN '$', COP '$'…).
//   - `showDualCurrency` → true only for Venezuela-style setups that display
//     BOTH the reference total AND the bolivar total (`total_bs`). This is the
//     flag the order table uses to decide whether to render the "Total Bs"
//     column — NOT the country code, so a non-VE catalog never shows Bs.
//
// Cache strategy — hit localStorage first, DB last:
//   1. `load(tenantId)` reads `tenant_currency_{tenantId}` from localStorage.
//      If present (and on the current schema) → state populates synchronously.
//   2. On cache miss → fetch from Supabase, then write back to localStorage.
//   3. When the editor persists a currency change via
//      `EcommerceConfigStore.saveCurrencyConfig()` / `saveTenantCountry()`,
//      it calls `TenantCurrencyStore.setCurrency()` — which updates both
//      the in-memory signals and localStorage.
//
// The DB is the source of truth; localStorage is a read-through cache. The
// cache key carries a schema version (CACHE_VERSION) so older payloads — e.g.
// a tenant that used to be Venezuela and is now Dominican Republic — are
// transparently discarded and refetched instead of leaking stale Bs columns.
// -----------------------------------------------------------------------------

type State = {
  localCode: string;
  localSymbol: string;
  displayCode: string;
  displaySymbol: string;
  showDualCurrency: boolean;
  countryCode: string | null;
  isLoaded: boolean;
  isLoading: boolean;
};

const initialState: State = {
  localCode: 'USD',
  localSymbol: '$',
  displayCode: 'USD',
  displaySymbol: '$',
  showDualCurrency: false,
  countryCode: null,
  isLoaded: false,
  isLoading: false,
};

// Bump when the cached shape changes so stale payloads are discarded.
const CACHE_VERSION = 3;
const STORAGE_PREFIX = 'tenant_currency_';

interface CachedCurrency {
  v?: number;
  localCode: string;
  localSymbol: string;
  displayCode: string;
  displaySymbol: string;
  showDualCurrency: boolean;
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
    // Reject payloads from an older schema (missing fields / version) so a
    // tenant that changed country doesn't keep rendering the old currency.
    if (parsed.v !== CACHE_VERSION) return null;
    if (!parsed.localCode || !parsed.displaySymbol) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(tenantId: number | string, value: CachedCurrency): void {
  try {
    localStorage.setItem(
      cacheKey(tenantId),
      JSON.stringify({ ...value, v: CACHE_VERSION })
    );
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

function symbolForCode(code: string): string {
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol ??
    findCurrencyByCode(code)?.symbol ??
    '$'
  );
}

export const TenantCurrencyStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isVenezuela: computed(() => store.countryCode() === 'VE'),
  })),
  withMethods((store) => {
    const client = SupabaseClientProvider.getInstance();
    // Ensures the background reconciliation runs at most once per app session
    // (the editor's setCurrency keeps things fresh after the first load).
    let revalidated = false;

    // Fetch the live currency config from Supabase and write it into the store
    // + cache. `silent` (background revalidation) avoids touching loading flags
    // and only re-renders when something actually changed.
    const fetchFromDb = async (
      tenantId: number | string,
      silent: boolean
    ): Promise<void> => {
      try {
        const [tenantRes, currencyRes] = await Promise.all([
          client
            .from('tenants')
            .select('country_code')
            .eq('id', tenantId)
            .maybeSingle(),
          client
            .from('tenant_currency_config')
            .select(
              'product_currency, display_currency, show_dual_currency, currency_symbol'
            )
            .eq('tenant_id', Number(tenantId))
            .maybeSingle(),
        ]);

        const countryCode =
          (tenantRes.data as { country_code?: string } | null)?.country_code ?? null;

        let localCode = 'USD';
        let localSymbol = '$';
        let displayCode = 'USD';
        let displaySymbol = '$';
        let showDualCurrency = false;

        if (currencyRes.data) {
          localCode = currencyRes.data.product_currency ?? 'USD';
          localSymbol =
            currencyRes.data.currency_symbol ?? symbolForCode(localCode);
          displayCode = currencyRes.data.display_currency ?? localCode;
          displaySymbol = symbolForCode(displayCode);
          showDualCurrency = currencyRes.data.show_dual_currency ?? false;
        } else {
          // No currency_config row — derive from country defaults.
          const country = findCountryByCode(countryCode);
          if (country) {
            localCode = country.defaultCurrency;
            localSymbol = symbolForCode(localCode);
          }
          if (countryCode === 'VE') {
            // VE without a persisted config still shows USD reference + Bs.
            displayCode = 'USD';
            displaySymbol = '$';
            showDualCurrency = true;
          } else {
            displayCode = localCode;
            displaySymbol = localSymbol;
          }
        }

        const changed =
          store.localCode() !== localCode ||
          store.localSymbol() !== localSymbol ||
          store.displayCode() !== displayCode ||
          store.displaySymbol() !== displaySymbol ||
          store.showDualCurrency() !== showDualCurrency ||
          store.countryCode() !== countryCode;

        // In silent mode, only patch when the DB actually diverged from the
        // cached state — otherwise leave the rendered state untouched.
        if (!silent || changed) {
          patchState(store, {
            countryCode,
            localCode,
            localSymbol,
            displayCode,
            displaySymbol,
            showDualCurrency,
            isLoaded: true,
            isLoading: false,
          });
        } else if (!silent) {
          patchState(store, { isLoaded: true, isLoading: false });
        }
        writeCache(tenantId, {
          localCode,
          localSymbol,
          displayCode,
          displaySymbol,
          showDualCurrency,
          countryCode,
        });
      } catch {
        patchState(store, { isLoading: false, isLoaded: true });
      }
    };

    return {
      async load(tenantId: number | string): Promise<void> {
        // 1. Cache-first: populate state synchronously from localStorage so
        //    downstream consumers render immediately with no DB round-trip.
        const cached = readCache(tenantId);
        if (cached) {
          if (!store.isLoaded()) {
            patchState(store, {
              localCode: cached.localCode,
              localSymbol: cached.localSymbol,
              displayCode: cached.displayCode,
              displaySymbol: cached.displaySymbol,
              showDualCurrency: cached.showDualCurrency,
              countryCode: cached.countryCode,
              isLoaded: true,
            });
          }
          // 2. Stale-while-revalidate: reconcile with the DB once in the
          //    background so a country/currency change made in another session
          //    self-heals without a manual cache clear.
          if (!revalidated) {
            revalidated = true;
            void fetchFromDb(tenantId, true);
          }
          return;
        }

        // 3. Cache miss → block on a fresh fetch, then cache it.
        if (store.isLoaded() || store.isLoading()) return;
        revalidated = true;
        patchState(store, { isLoading: true });
        await fetchFromDb(tenantId, false);
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
        const displayCode = payload.displayCode ?? store.displayCode();
        const next: CachedCurrency = {
          localCode: payload.localCode ?? store.localCode(),
          localSymbol: payload.localSymbol ?? store.localSymbol(),
          displayCode,
          // Derive the reference symbol from the code when the caller only
          // passes displayCode (the editor does), so VE→USD/EUR and any
          // country switch always cache the right symbol.
          displaySymbol:
            payload.displaySymbol ??
            (payload.displayCode ? symbolForCode(payload.displayCode) : store.displaySymbol()),
          showDualCurrency:
            payload.showDualCurrency ?? store.showDualCurrency(),
          countryCode:
            payload.countryCode !== undefined
              ? payload.countryCode
              : store.countryCode(),
        };
        patchState(store, {
          localCode: next.localCode,
          localSymbol: next.localSymbol,
          displayCode: next.displayCode,
          displaySymbol: next.displaySymbol,
          showDualCurrency: next.showDualCurrency,
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
