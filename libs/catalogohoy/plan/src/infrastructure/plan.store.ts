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
import { CheckoutService } from './checkout.service';
import { PlanService } from './plan.service';

// Per-plan brand palette. Same source of truth for the navbar badge,
// the avatar dropdown summary, and any future plan-aware accent.
const PLAN_PALETTE: Record<string, { color: string; bg: string }> = {
  gratis:   { color: '#64748b', bg: '#f1f5f9' },
  basico:   { color: '#6366f1', bg: '#eef2ff' },
  avanzado: { color: '#7c3aed', bg: '#f5f3ff' },
};
const DEFAULT_PALETTE = PLAN_PALETTE['basico'];

type PlanState = {
  plans: Plan[];
  tenantPlanUsage: TenantPlanUsage | null;
  isLoading: boolean;
  planExpired: boolean;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  isFreePlan: boolean;
};

const initialState: PlanState = {
  plans: [],
  tenantPlanUsage: null,
  isLoading: false,
  planExpired: false,
  planStartedAt: null,
  planExpiresAt: null,
  isFreePlan: false,
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
    maxProducts: computed(() => store.tenantPlanUsage()?.plan.maxProducts ?? 0),
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
    maxCatalogs: computed(() => store.tenantPlanUsage()?.plan.maxCatalogs ?? 1),
    extraCatalogs: computed(() => store.tenantPlanUsage()?.extraCatalogs ?? 0),
    maxTeamMembers: computed(
      () => store.tenantPlanUsage()?.plan.maxTeamMembers ?? 0
    ),
    usagePercentage: computed(() => {
      const usage = store.tenantPlanUsage();
      if (!usage) return 0;
      // `maxProducts <= 0` is the unlimited sentinel — there's no meaningful
      // usage % to render, so we collapse to 0 and let the UI hide the bar.
      if (usage.plan.maxProducts <= 0) return 0;
      return Math.round(
        (usage.currentProductCount / usage.plan.maxProducts) * 100
      );
    }),
    isPlanExpired: computed(() => store.planExpired()),
    // Covers both the public-catalog flow (sets the `isFreePlan` state flag
    // via checkExpiredBySlug) and the admin flow (loads tenantPlanUsage.plan).
    isFreePlan: computed(
      () => store.isFreePlan() || (store.tenantPlanUsage()?.plan.isFree ?? false)
    ),
    planExpiresAtDate: computed(() =>
      store.planExpiresAt() ? new Date(store.planExpiresAt()!) : null
    ),
    planStartedAtDate: computed(() =>
      store.planStartedAt() ? new Date(store.planStartedAt()!) : null
    ),
    currentPlanPalette: computed(() => {
      const id = store.tenantPlanUsage()?.plan.id ?? '';
      return PLAN_PALETTE[id] ?? DEFAULT_PALETTE;
    }),
    daysUntilExpiration: computed(() => {
      const expiresAt = store.planExpiresAt();
      if (!expiresAt || store.isFreePlan()) return null;
      const diff = new Date(expiresAt).getTime() - Date.now();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }),
    showExpirationBanner: computed(() => {
      const expiresAt = store.planExpiresAt();
      if (!expiresAt || store.isFreePlan() || store.planExpired()) return false;
      const diff = new Date(expiresAt).getTime() - Date.now();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 6;
    }),
  })),
  withMethods(
    (
      store,
      planService = inject(PlanService),
      checkoutService = inject(CheckoutService),
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
        // Skip if already loaded — store is a singleton, data persists across navigation
        if (store.tenantPlanUsage() !== null) return;

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
              planStartedAt: tenantPlanUsage.planStartedAt,
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
            planStartedAt: tenantPlanUsage.planStartedAt,
            planExpiresAt: tenantPlanUsage.planExpiresAt,
          })
        );
      },

      async checkExpiredBySlug(slug: string) {
        const result = await planService.getTenantExpiredBySlug(slug);
        result.mapRight((info) =>
          patchState(store, {
            planExpired: info.planExpired,
            isFreePlan: info.isFreePlan,
          })
        );
      },

      setPlanPublicStatus(planExpired: boolean, isFreePlan: boolean) {
        patchState(store, { planExpired, isFreePlan });
      },

      /** Add extra catalog slots to the active subscription. Returns error message or null. */
      async addCatalogSlots(
        additionalQuantity: number
      ): Promise<string | null> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return 'No se pudo obtener información del negocio.';

        const result = await checkoutService.updateCatalogSlots({
          tenantId,
          additionalQuantity,
        });

        return result
          .mapRight(({ extraCatalogs }) => {
            const current = store.tenantPlanUsage();
            if (current) {
              patchState(store, {
                tenantPlanUsage: { ...current, extraCatalogs },
              });
            }
            return null as string | null;
          })
          .mapLeft((err) => err.message).value as string | null;
      },
    })
  )
);
