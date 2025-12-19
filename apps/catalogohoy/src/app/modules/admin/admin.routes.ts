import { Route } from '@angular/router';

export const adminRoutes: Route[] = [
  {
    path: 'profile',
    loadComponent: () => import('@catalogohoy/profile').then((m) => m.Profile),
  },
];
