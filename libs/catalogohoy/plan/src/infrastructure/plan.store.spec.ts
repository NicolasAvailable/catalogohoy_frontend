// Mock the @catalogohoy/tenant barrel before any import pulls in its presenter
// layer (which drags in @primeuix/themes subpath exports that jest can't resolve).
// Only the TenantStore symbol is needed here — we override it via TestBed anyway.
jest.mock('@catalogohoy/tenant', () => ({
  TenantStore: class TenantStore {},
  getTenantSlugFromUrl: () => null,
}));

jest.mock('@catalogohoy/core', () => ({
  SupabaseClientProvider: { getInstance: () => ({}), create: () => ({}) },
}));

import { TestBed } from '@angular/core/testing';
import { TenantStore } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import { Plan, TenantPlanUsage } from '../domain';
import { CheckoutService } from './checkout.service';
import { PlanService } from './plan.service';
import { PlanStore } from './plan.store';

const freePlan: Plan = {
  id: 'gratis',
  name: 'Gratis',
  description: 'Plan gratuito',
  price: 0,
  maxProducts: 20,
  maxCatalogs: 1,
  maxTeamMembers: 0,
  maxVariants: 1,
  isFree: true,
  position: 0,
};

const paidPlan: Plan = {
  id: 'basico',
  name: 'Básico',
  description: 'Plan básico',
  price: 9.99,
  maxProducts: 100,
  maxCatalogs: 1,
  maxTeamMembers: 1,
  maxVariants: 3,
  isFree: false,
  position: 1,
};

function buildUsage(overrides: Partial<TenantPlanUsage> = {}): TenantPlanUsage {
  return {
    plan: paidPlan,
    currentProductCount: 10,
    canCreateProduct: true,
    remainingProducts: 90,
    currentCatalogCount: 1,
    canCreateCatalog: false,
    remainingCatalogs: 0,
    extraCatalogs: 0,
    planExpired: false,
    planStartedAt: null,
    planExpiresAt: null,
    hasStripeSubscription: false,
    ...overrides,
  };
}

describe('PlanStore', () => {
  let store: InstanceType<typeof PlanStore>;
  let planService: jest.Mocked<PlanService>;
  let checkoutService: jest.Mocked<CheckoutService>;
  let tenantStore: { getTenantIdAsync: jest.Mock; userId: jest.Mock };

  beforeEach(() => {
    planService = {
      getAll: jest.fn(),
      getTenantPlanUsage: jest.fn(),
      getTenantExpiredBySlug: jest.fn(),
    } as unknown as jest.Mocked<PlanService>;

    checkoutService = {
      updateCatalogSlots: jest.fn(),
    } as unknown as jest.Mocked<CheckoutService>;

    tenantStore = {
      getTenantIdAsync: jest.fn().mockResolvedValue(42),
      userId: jest.fn().mockReturnValue(7),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: PlanService, useValue: planService },
        { provide: CheckoutService, useValue: checkoutService },
        { provide: TenantStore, useValue: tenantStore },
      ],
    });

    store = TestBed.inject(PlanStore);
  });

  describe('initial state', () => {
    it('boots with the initial defaults', () => {
      expect(store.plans()).toEqual([]);
      expect(store.tenantPlanUsage()).toBeNull();
      expect(store.isLoading()).toBe(false);
      expect(store.planExpired()).toBe(false);
      expect(store.isFreePlan()).toBe(false);
    });

    it('exposes safe defaults on the computed selectors when usage is null', () => {
      expect(store.canCreateProduct()).toBe(true);
      expect(store.currentProductCount()).toBe(0);
      expect(store.maxProducts()).toBe(0);
      expect(store.remainingProducts()).toBe(0);
      expect(store.currentPlan()).toBeNull();
      expect(store.canCreateCatalog()).toBe(false);
      expect(store.maxCatalogs()).toBe(1);
      expect(store.maxTeamMembers()).toBe(0);
      expect(store.usagePercentage()).toBe(0);
      expect(store.planExpiresAtDate()).toBeNull();
      expect(store.daysUntilExpiration()).toBeNull();
      expect(store.showExpirationBanner()).toBe(false);
    });
  });

  describe('loadPlans', () => {
    it('stores the result on success', async () => {
      planService.getAll.mockResolvedValue(E.right([freePlan, paidPlan]));
      await store.loadPlans();
      expect(store.plans()).toEqual([freePlan, paidPlan]);
      expect(store.isLoading()).toBe(false);
    });

    it('clears isLoading on failure without crashing', async () => {
      planService.getAll.mockResolvedValue(E.left(new Error('boom')));
      await store.loadPlans();
      expect(store.plans()).toEqual([]);
      expect(store.isLoading()).toBe(false);
    });
  });

  describe('loadTenantPlanUsage', () => {
    it('skips the fetch when usage is already loaded (cached singleton)', async () => {
      planService.getTenantPlanUsage.mockResolvedValue(E.right(buildUsage()));
      await store.loadTenantPlanUsage();
      await store.loadTenantPlanUsage();
      expect(planService.getTenantPlanUsage).toHaveBeenCalledTimes(1);
    });

    it('propagates expiration state into the top-level flags', async () => {
      planService.getTenantPlanUsage.mockResolvedValue(
        E.right(
          buildUsage({ planExpired: true, planExpiresAt: '2030-01-01T00:00:00Z' })
        )
      );
      await store.loadTenantPlanUsage();
      expect(store.planExpired()).toBe(true);
      expect(store.planExpiresAt()).toBe('2030-01-01T00:00:00Z');
      expect(store.isPlanExpired()).toBe(true);
    });

    it('bails out silently when the tenant/user id is missing', async () => {
      tenantStore.getTenantIdAsync.mockResolvedValueOnce(null);
      await store.loadTenantPlanUsage();
      expect(planService.getTenantPlanUsage).not.toHaveBeenCalled();
    });
  });

  describe('isFreePlan computed', () => {
    it('returns true when the public-catalog flow set the flag directly', async () => {
      planService.getTenantExpiredBySlug.mockResolvedValue(
        E.right({ planExpired: false, isFreePlan: true })
      );
      await store.checkExpiredBySlug('some-slug');
      expect(store.isFreePlan()).toBe(true);
    });

    it('returns true when tenantPlanUsage.plan.isFree is true (admin flow)', async () => {
      planService.getTenantPlanUsage.mockResolvedValue(
        E.right(buildUsage({ plan: freePlan }))
      );
      await store.loadTenantPlanUsage();
      expect(store.isFreePlan()).toBe(true);
    });

    it('returns false when both sources say "paid"', async () => {
      planService.getTenantPlanUsage.mockResolvedValue(
        E.right(buildUsage({ plan: paidPlan }))
      );
      await store.loadTenantPlanUsage();
      expect(store.isFreePlan()).toBe(false);
    });
  });

  describe('expiration banner', () => {
    beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-04-18')));
    afterEach(() => jest.useRealTimers());

    it('shows the banner when expiration is within 6 days', async () => {
      const expiresAt = new Date('2026-04-22').toISOString(); // 4 days out
      planService.getTenantPlanUsage.mockResolvedValue(
        E.right(buildUsage({ plan: paidPlan, planExpiresAt: expiresAt }))
      );
      await store.loadTenantPlanUsage();
      expect(store.daysUntilExpiration()).toBe(4);
      expect(store.showExpirationBanner()).toBe(true);
    });

    it('hides the banner when no expiration date is set (free-plan default)', async () => {
      planService.getTenantPlanUsage.mockResolvedValue(
        E.right(buildUsage({ plan: freePlan, planExpiresAt: null }))
      );
      await store.loadTenantPlanUsage();
      expect(store.daysUntilExpiration()).toBeNull();
      expect(store.showExpirationBanner()).toBe(false);
    });

    it('hides the banner once the plan has expired', async () => {
      const expiresAt = new Date('2026-04-10').toISOString();
      planService.getTenantPlanUsage.mockResolvedValue(
        E.right(
          buildUsage({
            plan: paidPlan,
            planExpiresAt: expiresAt,
            planExpired: true,
          })
        )
      );
      await store.loadTenantPlanUsage();
      expect(store.showExpirationBanner()).toBe(false);
    });
  });

  describe('addCatalogSlots', () => {
    beforeEach(async () => {
      planService.getTenantPlanUsage.mockResolvedValue(
        E.right(buildUsage({ extraCatalogs: 1 }))
      );
      await store.loadTenantPlanUsage();
    });

    it('patches extraCatalogs on the cached usage and returns null (no error)', async () => {
      checkoutService.updateCatalogSlots.mockResolvedValue(
        E.right({ extraCatalogs: 3 })
      );
      const result = await store.addCatalogSlots(2);
      expect(result).toBeNull();
      expect(store.extraCatalogs()).toBe(3);
    });

    it('returns the error message when the checkout service fails', async () => {
      checkoutService.updateCatalogSlots.mockResolvedValue(
        E.left(new Error('stripe down'))
      );
      const result = await store.addCatalogSlots(1);
      expect(result).toBe('stripe down');
    });

    it('reports a friendly error when there is no tenant id', async () => {
      tenantStore.getTenantIdAsync.mockResolvedValueOnce(null);
      const result = await store.addCatalogSlots(1);
      expect(result).toBe('No se pudo obtener información del negocio.');
      expect(checkoutService.updateCatalogSlots).not.toHaveBeenCalled();
    });
  });
});
