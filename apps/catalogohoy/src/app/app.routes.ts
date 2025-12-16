import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./layouts/layout').then((m) => m.default),
    children: [
      {
        path: 'profile',
        loadComponent: () =>
          import('@catalogohoy/profile').then((m) => m.Profile),
      },
    ],
  },
];
