import { Route } from '@angular/router';

export const payingClientsRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./paying-clients').then((m) => m.PayingClients),
  },
];
