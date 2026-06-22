import { Route } from '@angular/router';
import { authenticationGuard } from '@catalogohoy/auth';
import { profileResolver } from '@catalogohoy/profile';
import { isValidSlugGuard } from '@catalogohoy/tenant';
import { hasAccessGuard, teamPermissionsResolver } from '@catalogohoy/teams';

export const appRoutes: Route[] = [
  {
    path: '',
    canActivate: [isValidSlugGuard],
    loadChildren: () =>
      import('@catalogohoy/e-commerce').then((m) => m.ecommerceRoutes),
  },
  {
    path: 'admin',
    canActivate: [isValidSlugGuard, authenticationGuard],
    resolve: {
      profile: profileResolver,
      teamPermissions: teamPermissionsResolver,
    },
    canActivateChild: [hasAccessGuard],
    loadComponent: () => import('./layouts/layout').then((m) => m.default),
    loadChildren: () =>
      import('./modules/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: 'catalog-unavailable',
    loadComponent: () =>
      import('@catalogohoy/tenant').then((m) => m.CatalogUnavailableView),
  },
  {
    path: 'public/report',
    loadChildren: () =>
      import('@catalogohoy/reports').then((m) => m.REPORTS_PUBLIC_ROUTES),
  },
  {
    path: 'no-access',
    canActivate: [authenticationGuard],
    resolve: {
      profile: profileResolver,
    },
    loadComponent: () =>
      import('@catalogohoy/teams').then((m) => m.NoAccessView),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

