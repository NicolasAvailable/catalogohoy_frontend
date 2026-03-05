import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { TenantStore } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from './team-permissions.store';

export const hasAccessGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const store = inject(TeamPermissionsStore);
  const router = inject(Router);

  if (!store.isLoaded()) {
    const tenantStore = inject(TenantStore);
    const tenantId = await tenantStore.getTenantIdAsync();
    if (tenantId) {
      await store.load(tenantId);
    } else {
      store.markAsLoaded();
    }
  }

  if (store.hasAccess()) return true;
  return router.createUrlTree(['/no-access']);
};
