import { Route } from '@angular/router';

export const tenantsRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./tenants').then((m) => m.Tenants),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./tenant-detail/tenant-detail').then((m) => m.TenantDetail),
  },
];
