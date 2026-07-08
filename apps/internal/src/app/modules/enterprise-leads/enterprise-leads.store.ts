import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { EnterpriseLead, EnterpriseLeadStatus } from './enterprise-leads.model';
import { EnterpriseLeadsService } from './enterprise-leads.service';

type EnterpriseLeadsState = {
  leads: EnterpriseLead[];
  isLoading: boolean;
  error: string | null;
};

const initialState: EnterpriseLeadsState = {
  leads: [],
  isLoading: false,
  error: null,
};

export const EnterpriseLeadsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    counts: computed(() => {
      const list = store.leads();
      const qualified = list.filter((l) => l.qualified).length;
      const won = list.filter((l) => l.status === 'won').length;
      const pending = list.filter((l) => l.status === 'new').length;
      return { total: list.length, qualified, won, pending };
    }),
  })),
  withMethods((store, service = inject(EnterpriseLeadsService)) => ({
    async load() {
      patchState(store, { isLoading: true, error: null });
      const result = await service.list();
      result
        .mapRight((leads) => patchState(store, { leads, isLoading: false }))
        .mapLeft((error) =>
          patchState(store, { error: error.message, isLoading: false })
        );
    },

    /** Optimista: actualiza local y revierte si la RPC falla. */
    async updateStatus(id: number, status: EnterpriseLeadStatus) {
      const previous = store.leads();
      patchState(store, {
        leads: previous.map((l) => (l.id === id ? { ...l, status } : l)),
      });
      const result = await service.updateStatus(id, status);
      result.mapLeft((error) =>
        patchState(store, { leads: previous, error: error.message })
      );
    },
  }))
);
