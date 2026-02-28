import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { PlanStore } from './plan.store';

export const freePlanGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const planStore = inject(PlanStore);
  const router = inject(Router);

  if (planStore.tenantPlanUsage() === null) {
    await planStore.loadTenantPlanUsage();
  }

  if (planStore.currentPlan()?.isFree) {
    return router.createUrlTree(['/admin/plans']);
  }

  return true;
};
