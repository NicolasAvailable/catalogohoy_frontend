import { inject, isDevMode } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { RESERVED_SUBDOMAIN_REDIRECTS } from '@catalogohoy/core';
import { getTenantSlugFromUrl, isCustomDomain, setCustomDomainSlug } from '../presenter';
import { TenantService } from './tenant.service';

/** In-app route that explains why the catalog can't be shown (not found / error)
 *  instead of hard-redirecting to the marketing site. */
const unavailable = (
  router: Router,
  params: Record<string, string>
): UrlTree => router.createUrlTree(['/catalog-unavailable'], { queryParams: params });

export const isValidSlugGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  if (isDevMode()) {
    return true;
  }

  const subdomain = window.location.hostname.split('.')[0];
  const reservedRedirect = RESERVED_SUBDOMAIN_REDIRECTS[subdomain];
  if (reservedRedirect) {
    window.location.href = reservedRedirect;
    return false;
  }

  const router = inject(Router);
  const tenantService = inject(TenantService);

  if (isCustomDomain()) {
    const domain = window.location.hostname.replace(/^www\./, '');
    const slug = await tenantService.getSlugByCustomDomain(domain);
    if (!slug) {
      return unavailable(router, { reason: 'not-found' });
    }
    setCustomDomainSlug(slug);
    return true;
  }

  const slug = getTenantSlugFromUrl();
  if (!slug) {
    return unavailable(router, { reason: 'not-found' });
  }

  const result = await tenantService.checkSlug(slug);
  if (result.status === 'valid') {
    return true;
  }
  if (result.status === 'not-found') {
    return unavailable(router, { reason: 'not-found', slug });
  }
  // The check itself failed (e.g. an aborted RPC during bootstrap) — show an
  // error with a retry rather than pretending the catalog doesn't exist.
  return unavailable(router, { reason: 'error', slug, detail: result.message });
};
