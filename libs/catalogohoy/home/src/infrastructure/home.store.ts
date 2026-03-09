import { inject } from '@angular/core';
import { HomeStats, OrderService } from '@catalogohoy/order';
import { TenantStore } from '@catalogohoy/tenant';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

type HomeState = {
  stats: HomeStats | null;
  isLoading: boolean;
};

const initialState: HomeState = {
  stats: null,
  isLoading: false,
};

export const HomeStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (
      store,
      orderService = inject(OrderService),
      tenantStore = inject(TenantStore)
    ) => ({
      async loadStats(): Promise<void> {
        patchState(store, { isLoading: true });

        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) {
          patchState(store, { isLoading: false });
          return;
        }

        const result = await orderService.getHomeStats(tenantId);

        if (result.isRight()) {
          patchState(store, { stats: result.value as HomeStats, isLoading: false });
        } else {
          patchState(store, { isLoading: false });
        }
      },
    })
  )
);
