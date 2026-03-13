import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { TenantStore } from '@catalogohoy/tenant';
import { PermissionAction, PermissionModule } from '../domain';
import { TeamPermissionsStore } from './team-permissions.store';

export function teamPermissionGuard(
  module: PermissionModule,
  action: PermissionAction
): CanActivateFn {
  return async (): Promise<boolean | UrlTree> => {
    const store = inject(TeamPermissionsStore);
    const router = inject(Router);

    // If permissions weren't loaded by the resolver (e.g., session not ready on
    // hard reload), retry here so the user isn't incorrectly redirected home.
    if (!store.isLoaded()) {
      const tenantStore = inject(TenantStore);
      const tenantId = await tenantStore.getTenantIdAsync();
      if (tenantId) {
        await store.load(tenantId);
      } else {
        store.markAsLoaded();
      }
    }

    if (store.isOwner() || store.can()(module, action)) return true;
    return router.createUrlTree(['/admin']);
  };
}
