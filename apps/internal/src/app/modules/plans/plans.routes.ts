import { Route } from '@angular/router';

export const plansRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./plans').then((m) => m.Plans),
  },
];
