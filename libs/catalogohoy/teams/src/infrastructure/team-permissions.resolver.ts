import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { TenantStore } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from './team-permissions.store';

export const teamPermissionsResolver: ResolveFn<boolean> = async () => {
  const store = inject(TeamPermissionsStore);
  const tenantStore = inject(TenantStore);
  const tenantId = await tenantStore.getTenantIdAsync();
  if (tenantId) {
    await store.load(tenantId);
  } else {
    // No tenant resolved — mark as loaded so guards don't wait indefinitely
    store.markAsLoaded();
  }
  return true;
};
