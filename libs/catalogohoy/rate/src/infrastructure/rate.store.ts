import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { E } from '@shared/domain';
import { ExchangeRate, RateType } from '../domain/rate';
import { RateService } from './rate.service';

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
  withMethods((store) => {
    const rateService = inject(RateService);

    return {
      async loadRates() {
        patchState(store, { isLoading: true, error: null });

        // Auto-sync BCV rates from bcv_rates table before loading
        await rateService.syncBcvRates();

        const result = await rateService.getRates();
        patchState(store, { isLoading: false });

        result.fold(
          (error: Error) => patchState(store, { error: error.message }),
          (rate: ExchangeRate) => patchState(store, { rate })
        );
      },

      async updateActiveRate(
        rateType: RateType
      ): Promise<E.Either<string, void>> {
        patchState(store, { isLoading: true, error: null });
        const result = await rateService.updateActiveRate(rateType);
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

        return E.right(undefined);
      },

      async updateCustomRate(rate: number): Promise<E.Either<string, void>> {
        patchState(store, { isLoading: true, error: null });
        const result = await rateService.updateCustomRate(rate);
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
          // Reload everything to get the exact values from DB
          const reloadResult = await rateService.getRates();
          reloadResult.fold(
            () => {},
            (rate) => patchState(store, { rate })
          );
        }
      },
    };
  })
);
