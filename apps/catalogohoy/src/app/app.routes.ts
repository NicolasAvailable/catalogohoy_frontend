import { Route } from '@angular/router';
import { profileResolver } from '@catalogohoy/profile';

export const appRoutes: Route[] = [
  {
    path: '',
    resolve: {
      profile: profileResolver,
    },
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
