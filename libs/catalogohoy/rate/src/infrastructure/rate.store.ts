import { inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { E } from '@shared/domain';
import { ExchangeRate, RateType } from '../domain/rate';
import { RateService } from './rate.service';

type RateState = {
  rates: ExchangeRate | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: RateState = {
  rates: null,
  isLoading: false,
  error: null,
};

export const RateStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const rateService = inject(RateService);
    const tenantStore = inject(TenantStore);

    return {
      async loadRates() {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return;

        patchState(store, { isLoading: true, error: null });

        const result = await rateService.getRates(tenantId);

        patchState(store, { isLoading: false });

        result.fold(
          (error: Error) => patchState(store, { error: error.message }),
          (rates: ExchangeRate) => patchState(store, { rates })
        );
      },

      async updateActiveRate(
        rateType: RateType
      ): Promise<E.Either<string, void>> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return E.left('Tenant no encontrado');

        patchState(store, { isLoading: true, error: null });

        const result = await rateService.updateActiveRate(tenantId, rateType);

        patchState(store, { isLoading: false });

        return result.fold(
          (error: Error) => {
            patchState(store, { error: error.message });
            return E.left(error.message);
          },
          () => {
            const currentRates = store.rates();
            if (currentRates) {
              patchState(store, {
                rates: { ...currentRates, active_rate: rateType },
              });
            }
            return E.right(undefined);
          }
        );
      },

      async updateCustomRate(rate: number): Promise<E.Either<string, void>> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return E.left('Tenant no encontrado');

        patchState(store, { isLoading: true, error: null });

        const result = await rateService.updateCustomRate(tenantId, rate);

        patchState(store, { isLoading: false });

        return result.fold(
          (error: Error) => {
            patchState(store, { error: error.message });
            return E.left(error.message);
          },
          () => {
            const currentRates = store.rates();
            if (currentRates) {
              patchState(store, {
                rates: { ...currentRates, custom_rate: rate },
              });
            }
            return E.right(undefined);
          }
        );
      },

      async syncRates() {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return;

        patchState(store, { isLoading: true, error: null });

        const result = await rateService.syncBcvRates(tenantId);

        patchState(store, { isLoading: false });

        result.fold(
          (error: Error) => patchState(store, { error: error.message }),
          (rates: ExchangeRate) => patchState(store, { rates })
        );
      },
    };
  })
);
