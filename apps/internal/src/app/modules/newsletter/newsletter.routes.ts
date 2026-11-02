import { Route } from '@angular/router';

export const newsletterRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./newsletter').then((m) => m.Newsletter),
  },
];
