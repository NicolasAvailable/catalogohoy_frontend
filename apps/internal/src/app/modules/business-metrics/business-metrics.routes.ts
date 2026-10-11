import { Route } from '@angular/router';

export const businessMetricsRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./business-metrics').then((m) => m.BusinessMetrics),
  },
];
