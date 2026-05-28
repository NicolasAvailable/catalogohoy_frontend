import { Route } from '@angular/router';

export const internalRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'tenants',
    loadChildren: () =>
      import('./tenants/tenants.routes').then((m) => m.tenantsRoutes),
  },
  {
    path: 'users',
    loadChildren: () =>
      import('./users/users.routes').then((m) => m.usersRoutes),
  },
  {
    path: 'paying-clients',
    loadChildren: () =>
      import('./paying-clients/paying-clients.routes').then(
        (m) => m.payingClientsRoutes
      ),
  },
];
