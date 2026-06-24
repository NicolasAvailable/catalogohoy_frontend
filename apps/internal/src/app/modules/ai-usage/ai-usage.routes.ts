import { Route } from '@angular/router';

export const aiUsageRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./ai-usage').then((m) => m.AiUsage),
  },
];
