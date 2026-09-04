import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { E } from '@shared/domain';
import { EcommerceConfigService } from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { ExchangeRate, RateType } from '../domain/rate';
import { RateService } from './rate.service';

const RATE_CURRENCY_MAP: Record<RateType, { currency: string; currencySymbol: string }> = {
  bcv_usd: { currency: 'USD', currencySymbol: '$' },
  bcv_eur: { currency: 'EUR', currencySymbol: '€' },
  custom:  { currency: 'USD', currencySymbol: '$' },
};

type RateState = {
  rate: ExchangeRate | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: RateState = {
  rate: null,
  isLoading: false,
  error: null,
};

export const RateStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /** Valor numérico de la tasa ACTIVA del catálogo (según `active_rate`).
     *  0 cuando no hay tasa cargada. Fuente única para convertir USD→Bs. */
    rateValue: computed(() => {
      const r = store.rate();
      if (!r) return 0;
      const map: Record<string, number> = {
        bcv_usd: r.bcv_usd ?? 0,
        bcv_eur: r.bcv_eur ?? 0,
        custom: r.custom_rate ?? 0,
      };
      return map[r.active_rate] ?? 0;
    }),
  })),
  withMethods((store) => {
    const rateService = inject(RateService);
    const configService = inject(EcommerceConfigService);
    const tenantStore = inject(TenantStore);

    return {
      async loadRates() {
        patchState(store, { isLoading: true, error: null });

        // Auto-sync BCV rates from bcv_rates table before loading
        await rateService.syncBcvRates();

        const tenantId = await tenantStore.getTenantIdAsync();
        const result = await rateService.getRates(String(tenantId ?? ''));
        patchState(store, { isLoading: false });

        result.fold(
          (error: Error) => patchState(store, { error: error.message }),
          (rate: ExchangeRate) => patchState(store, { rate })
        );
      },

      async updateActiveRate(
        rateType: RateType
      ): Promise<E.Either<string, void>> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return E.left('No tenant found');

        patchState(store, { isLoading: true, error: null });
        const result = await rateService.updateActiveRate(String(tenantId), rateType);
        patchState(store, { isLoading: false });

        if (result.isLeft()) {
          const error = result.value.message;
          patchState(store, { error });
          return E.left(error);
        }

        // Optimistic update
        const currentRate = store.rate();
        if (currentRate) {
          patchState(store, {
            rate: { ...currentRate, active_rate: rateType },
          });
        }

        // Auto-update currency symbol in catalog config
        const { currency, currencySymbol } = RATE_CURRENCY_MAP[rateType];
        configService.updateConfig({
          tenantId: String(tenantId),
          currency,
          currencySymbol,
        });

        return E.right(undefined);
      },

      async updateCustomRate(rate: number): Promise<E.Either<string, void>> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return E.left('No tenant found');

        patchState(store, { isLoading: true, error: null });
        const result = await rateService.updateCustomRate(String(tenantId), rate);
        patchState(store, { isLoading: false });

        if (result.isLeft()) {
          const error = result.value.message;
          patchState(store, { error });
          return E.left(error);
        }

        const currentRate = store.rate();
        if (currentRate) {
          patchState(store, { rate: { ...currentRate, custom_rate: rate } });
        }

        return E.right(undefined);
      },

      async syncRates() {
        patchState(store, { isLoading: true, error: null });
        const result = await rateService.syncBcvRates();
        patchState(store, { isLoading: false });

        if (result.isLeft()) {
          patchState(store, { error: result.value.message });
        } else {
          const tenantId = await tenantStore.getTenantIdAsync();
          const reloadResult = await rateService.getRates(String(tenantId ?? ''));
          reloadResult.fold(
            () => {},
            (rate) => patchState(store, { rate })
          );
        }
      },
    };
  })
);
