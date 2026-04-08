import { Route } from '@angular/router';
import { authGuard, guestGuard } from './modules/auth/auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./modules/auth/login'),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/layout').then((m) => m.default),
    loadChildren: () =>
      import('./modules/internal.routes').then((m) => m.internalRoutes),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
