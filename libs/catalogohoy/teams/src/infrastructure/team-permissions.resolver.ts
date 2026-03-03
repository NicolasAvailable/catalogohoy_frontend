import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { TenantStore } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from './team-permissions.store';

export const teamPermissionsResolver: ResolveFn<boolean> = async () => {
  const store = inject(TeamPermissionsStore);
  const tenantStore = inject(TenantStore);
  const tenantId = await tenantStore.getTenantIdAsync();
  if (tenantId) await store.load(tenantId); // await so permissions are ready before child routes activate
  return true;
};
