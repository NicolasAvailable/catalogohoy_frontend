import { Route } from '@angular/router';

export const RATE_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./presenter/views/rate-view/rate-view').then((m) => m.RateView),
  },
];
