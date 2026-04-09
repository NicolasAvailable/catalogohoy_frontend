import { Route } from '@angular/router';

export const usersRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./users').then((m) => m.Users),
  },
];
