import { Route } from '@angular/router';

export const payingAccountsRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./paying-accounts').then((m) => m.default),
  },
];
