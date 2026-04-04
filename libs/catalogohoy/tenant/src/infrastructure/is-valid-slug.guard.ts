import { inject, isDevMode } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { getTenantSlugFromUrl, isCustomDomain, setCustomDomainSlug } from '../presenter';
import { TenantService } from './tenant.service';

export const isValidSlugGuard: CanActivateFn = async (): Promise<boolean> => {
  if (isDevMode()) {
    return true;
  }

  const tenantService = inject(TenantService);

  if (isCustomDomain()) {
    const domain = window.location.hostname.replace(/^www\./, '');
    const slug = await tenantService.getSlugByCustomDomain(domain);
    if (!slug) {
      window.location.href = 'https://catalogohoy.com';
      return false;
    }
    setCustomDomainSlug(slug);
    return true;
  }

  const slug = getTenantSlugFromUrl();
  if (!slug) {
    window.location.href = 'https://catalogohoy.com';
    return false;
  }
  const isValid = await tenantService.isValidSlug(slug);
  if (!isValid) {
    window.location.href = 'https://catalogohoy.com';
    return false;
  }
  return true;
};
