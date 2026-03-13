import { Route } from '@angular/router';

export const ANALYTICS_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./views/analytics-view/analytics-view').then(
        (c) => c.AnalyticsViewComponent
      ),
  },
];
