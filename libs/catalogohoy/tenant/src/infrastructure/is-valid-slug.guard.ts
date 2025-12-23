import { inject, isDevMode } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { getTenantSlugFromUrl } from '../presenter';
import { TenantService } from './tenant.service';

export const isValidSlugGuard: CanActivateFn = async (): Promise<boolean> => {
  // En modo desarrollo, siempre permitir el acceso
  if (isDevMode()) {
    return Promise.resolve(true);
  }

  const tenantService = inject(TenantService);
  const slug = getTenantSlugFromUrl();
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
};
