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

type TenantsState = {
  tenants: Tenant[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
};

const initialState: TenantsState = {
  tenants: [],
  isLoading: false,
  isMutating: false,
  error: null,
};

export const TenantsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, tenantsService = inject(TenantsService)) => ({
    async load() {
      patchState(store, { isLoading: true, error: null });
      const result = await tenantsService.list();
      result.fold(
        (err) => patchState(store, { isLoading: false, error: err.message }),
        (tenants) => patchState(store, { tenants, isLoading: false })
      );
    },

    async assignPlan(
      tenantId: number,
      tier: PlanTier,
      cycle: PlanCycle
    ): Promise<void> {
      patchState(store, { isMutating: true, error: null });
      const result = await tenantsService.assignPlan(tenantId, tier, cycle);
      patchState(store, { isMutating: false });
      if (result.isLeft()) {
        patchState(store, { error: result.value.message });
        return;
      }
      // Refresh from server to get the canonical expires_at
      const refreshed = await tenantsService.list();
      refreshed.mapRight((tenants) => patchState(store, { tenants }));
    },

    async removePlan(tenantId: number): Promise<void> {
      patchState(store, { isMutating: true, error: null });
      const result = await tenantsService.removePlan(tenantId);
      patchState(store, { isMutating: false });
      if (result.isLeft()) {
        patchState(store, { error: result.value.message });
        return;
      }
      const refreshed = await tenantsService.list();
      refreshed.mapRight((tenants) => patchState(store, { tenants }));
    },
  }))
);
