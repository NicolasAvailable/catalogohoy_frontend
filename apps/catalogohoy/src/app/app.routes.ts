import { Route } from '@angular/router';
import { profileResolver } from '@catalogohoy/profile';
import { authenticationGuard } from '@catalogohoy/auth';

export const appRoutes: Route[] = [
  {
    path: '',
    canActivate: [authenticationGuard],
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
