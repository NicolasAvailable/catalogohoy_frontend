import { computed, inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { Plan, TenantPlanUsage } from '../domain';
import { PlanService } from './plan.service';

type PlanState = {
  plans: Plan[];
  tenantPlanUsage: TenantPlanUsage | null;
  isLoading: boolean;
  planExpired: boolean;
  planExpiresAt: string | null;
};

const initialState: PlanState = {
  plans: [],
  tenantPlanUsage: null,
  isLoading: false,
  planExpired: false,
  planExpiresAt: null,
};

export const PlanStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    canCreateProduct: computed(
      () => store.tenantPlanUsage()?.canCreateProduct ?? true
    ),
    currentProductCount: computed(
      () => store.tenantPlanUsage()?.currentProductCount ?? 0
    ),
    maxProducts: computed(
      () => store.tenantPlanUsage()?.plan.maxProducts ?? 0
    ),
    remainingProducts: computed(
      () => store.tenantPlanUsage()?.remainingProducts ?? 0
    ),
    currentPlan: computed(() => store.tenantPlanUsage()?.plan ?? null),
    canCreateCatalog: computed(
      () => store.tenantPlanUsage()?.canCreateCatalog ?? false
    ),
    remainingCatalogs: computed(
      () => store.tenantPlanUsage()?.remainingCatalogs ?? 0
    ),
    currentCatalogCount: computed(
      () => store.tenantPlanUsage()?.currentCatalogCount ?? 0
    ),
    maxCatalogs: computed(
      () => store.tenantPlanUsage()?.plan.maxCatalogs ?? 1
    ),
    usagePercentage: computed(() => {
      const usage = store.tenantPlanUsage();
      if (!usage) return 0;
      return Math.round(
        (usage.currentProductCount / usage.plan.maxProducts) * 100
      );
    }),
    isPlanExpired: computed(() => store.planExpired()),
    planExpiresAtDate: computed(() =>
      store.planExpiresAt() ? new Date(store.planExpiresAt()!) : null
    ),
  })),
  withMethods(
    (
      store,
      planService = inject(PlanService),
      tenantStore = inject(TenantStore)
    ) => ({
      async loadPlans() {
        patchState(store, { isLoading: true });
        const result = await planService.getAll();
        result
          .mapRight((plans) => patchState(store, { plans, isLoading: false }))
          .mapLeft(() => patchState(store, { isLoading: false }));
      },

      async loadTenantPlanUsage() {
        const tenantId = await tenantStore.getTenantIdAsync();
        const userId = tenantStore.userId();
        if (!tenantId || !userId) return;

        patchState(store, { isLoading: true });
        const result = await planService.getTenantPlanUsage(tenantId, userId);
        result
          .mapRight((tenantPlanUsage) =>
            patchState(store, {
              tenantPlanUsage,
              isLoading: false,
              planExpired: tenantPlanUsage.planExpired,
              planExpiresAt: tenantPlanUsage.planExpiresAt,
            })
          )
          .mapLeft(() => patchState(store, { isLoading: false }));
      },

      async refreshUsage() {
        const tenantId = await tenantStore.getTenantIdAsync();
        const userId = tenantStore.userId();
        if (!tenantId || !userId) return;

        const result = await planService.getTenantPlanUsage(tenantId, userId);
        result.mapRight((tenantPlanUsage) =>
          patchState(store, {
            tenantPlanUsage,
            planExpired: tenantPlanUsage.planExpired,
            planExpiresAt: tenantPlanUsage.planExpiresAt,
          })
        );
      },

      async checkExpiredBySlug(slug: string) {
        const result = await planService.getTenantExpiredBySlug(slug);
        result.mapRight((expired) =>
          patchState(store, { planExpired: expired })
        );
      },
    })
  )
);
