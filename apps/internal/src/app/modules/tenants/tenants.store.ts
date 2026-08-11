import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { PlanCycle, PlanTier } from '../shared/plan-cycle.model';
import { Tenant } from './tenants.model';
import { TenantsService } from './tenants.service';

const PAGE_SIZE = 100;

type TenantsState = {
  tenants: Tenant[];
  total: number;
  search: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  isMutating: boolean;
  error: string | null;
};

const initialState: TenantsState = {
  tenants: [],
  total: 0,
  search: '',
  isLoading: false,
  isLoadingMore: false,
  isMutating: false,
  error: null,
};

export const TenantsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, tenantsService = inject(TenantsService)) => {
    /** Fetch the first page for the current search, replacing the list. */
    async function load(): Promise<void> {
      patchState(store, { isLoading: true, error: null });
      const result = await tenantsService.list({
        search: store.search(),
        limit: PAGE_SIZE,
        offset: 0,
      });
      result.fold(
        (err) => patchState(store, { isLoading: false, error: err.message }),
        (page) =>
          patchState(store, {
            tenants: page.rows,
            total: page.total,
            isLoading: false,
          })
      );
    }

    /** Re-fetch every currently-loaded row (keeps the scroll depth after a
     *  mutation) for the current search. */
    async function refresh(): Promise<void> {
      const keep = Math.max(store.tenants().length, PAGE_SIZE);
      const result = await tenantsService.list({
        search: store.search(),
        limit: keep,
        offset: 0,
      });
      result.mapRight((page) =>
        patchState(store, { tenants: page.rows, total: page.total })
      );
    }

    return {
      load,
      refresh,

      /** Debounced from the component: set the term and reload page 1. */
      async setSearch(term: string): Promise<void> {
        patchState(store, { search: term });
        await load();
      },

      /** Append the next page (server-side offset) without losing what's loaded. */
      async loadMore(): Promise<void> {
        if (store.isLoadingMore() || store.tenants().length >= store.total()) {
          return;
        }
        patchState(store, { isLoadingMore: true, error: null });
        const result = await tenantsService.list({
          search: store.search(),
          limit: PAGE_SIZE,
          offset: store.tenants().length,
        });
        result.fold(
          (err) =>
            patchState(store, { isLoadingMore: false, error: err.message }),
          (page) =>
            patchState(store, {
              tenants: [...store.tenants(), ...page.rows],
              total: page.total,
              isLoadingMore: false,
            })
        );
      },

      async assignPlan(
        tenantId: number,
        tier: PlanTier,
        cycle: PlanCycle,
        amountUsd: number,
        consumeCreditUsd: number | null = null
      ): Promise<void> {
        patchState(store, { isMutating: true, error: null });
        const result = await tenantsService.assignPlan(
          tenantId,
          tier,
          cycle,
          amountUsd,
          consumeCreditUsd
        );
        patchState(store, { isMutating: false });
        if (result.isLeft()) {
          patchState(store, { error: result.value.message });
          return;
        }
        await refresh();
      },

      async removePlan(tenantId: number): Promise<void> {
        patchState(store, { isMutating: true, error: null });
        const result = await tenantsService.removePlan(tenantId);
        patchState(store, { isMutating: false });
        if (result.isLeft()) {
          patchState(store, { error: result.value.message });
          return;
        }
        await refresh();
      },

      async setOwnersBanned(
        tenantId: number,
        banned: boolean
      ): Promise<number | null> {
        patchState(store, { isMutating: true, error: null });
        const result = await tenantsService.setOwnersBanned(tenantId, banned);
        patchState(store, { isMutating: false });
        if (result.isLeft()) {
          patchState(store, { error: result.value.message });
          return null;
        }
        return result.value;
      },
    };
  })
);
