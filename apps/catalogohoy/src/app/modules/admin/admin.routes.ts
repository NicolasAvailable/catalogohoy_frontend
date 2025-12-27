import { Route } from '@angular/router';

export const adminRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('@catalogohoy/home').then((m) => m.Home),
  },
  {
    path: 'profile',
    loadComponent: () => import('@catalogohoy/profile').then((m) => m.Profile),
  },
];
