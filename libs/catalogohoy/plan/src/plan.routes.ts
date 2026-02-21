import { Route } from '@angular/router';

export const planRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./presenter/plans/plans').then((m) => m.Plans),
  },
];
