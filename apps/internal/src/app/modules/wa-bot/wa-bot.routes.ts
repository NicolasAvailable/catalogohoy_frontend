import { Route } from '@angular/router';

export const waBotRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./wa-bot').then((m) => m.WaBot),
  },
];
