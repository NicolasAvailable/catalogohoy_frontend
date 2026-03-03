import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { PermissionAction, PermissionModule } from '../domain';
import { TeamPermissionsStore } from './team-permissions.store';

export function teamPermissionGuard(
  module: PermissionModule,
  action: PermissionAction
): CanActivateFn {
  return (): boolean | UrlTree => {
    const store = inject(TeamPermissionsStore);
    const router = inject(Router);
    if (store.isOwner() || store.can()(module, action)) return true;
    return router.createUrlTree(['/admin']);
  };
}
