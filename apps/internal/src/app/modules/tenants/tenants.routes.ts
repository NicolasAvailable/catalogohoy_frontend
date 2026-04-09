import { Route } from '@angular/router';

export const tenantsRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./tenants').then((m) => m.Tenants),
  },
];
