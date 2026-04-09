import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  computeStatus,
  PayingClient,
  SubscriptionHistoryEntry,
} from './paying-clients.model';
import { PayingClientsService } from './paying-clients.service';

type PayingClientsState = {
  clients: PayingClient[];
  history: SubscriptionHistoryEntry[];
  selectedTenantId: number | null;
  isLoading: boolean;
  isLoadingHistory: boolean;
  error: string | null;
};

const initialState: PayingClientsState = {
  clients: [],
  history: [],
  selectedTenantId: null,
  isLoading: false,
  isLoadingHistory: false,
  error: null,
};

export const PayingClientsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    counts: computed(() => {
      const list = store.clients();
      let active = 0;
      let expiring = 0;
      let expired = 0;
      for (const c of list) {
        const status = computeStatus(c.daysUntilExpiry);
        if (status === 'active') active++;
        else if (status === 'expiring') expiring++;
        else expired++;
      }
      return { active, expiring, expired, total: list.length };
    }),
    selectedClient: computed(
      () =>
        store.clients().find((c) => c.tenantId === store.selectedTenantId()) ??
        null
    ),
  })),
  withMethods((store, service = inject(PayingClientsService)) => ({
    async load() {
      patchState(store, { isLoading: true, error: null });
      const result = await service.list();
      result.fold(
        (err) => patchState(store, { isLoading: false, error: err.message }),
        (clients) => patchState(store, { clients, isLoading: false })
      );
    },

    async openDetail(tenantId: number) {
      patchState(store, {
        selectedTenantId: tenantId,
        isLoadingHistory: true,
        history: [],
      });
      const result = await service.getHistory(tenantId);
      result.fold(
        () => patchState(store, { isLoadingHistory: false }),
        (history) => patchState(store, { history, isLoadingHistory: false })
      );
    },

    closeDetail() {
      patchState(store, {
        selectedTenantId: null,
        history: [],
        isLoadingHistory: false,
      });
    },
  }))
);
