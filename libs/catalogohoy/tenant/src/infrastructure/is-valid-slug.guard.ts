import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { environment } from '@catalogohoy/env';
import { getTenantSlugFromUrl } from '../presenter';
import { TenantService } from './tenant.service';

export const isValidSlugGuard: CanActivateFn = async (): Promise<boolean> => {
  const tenantService = inject(TenantService);
  const slug = getTenantSlugFromUrl();
  if (environment.production) {
    if (!slug) {
      window.location.href = 'https://catalogohoy.com';
      return Promise.resolve(false);
    }
    const isValid = await tenantService.isValidSlug(slug);
    if (!isValid) {
      window.location.href = 'https://catalogohoy.com';
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  } else {
    return Promise.resolve(true);
  }
};
