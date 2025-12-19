import { Route } from '@angular/router';
import { authenticationGuard } from '@catalogohoy/auth';
import { profileResolver } from '@catalogohoy/profile';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('@catalogohoy/e-commerce').then((m) => m.ECommerce),
  },
  {
    path: 'admin',
    canActivate: [authenticationGuard],
    resolve: {
      profile: profileResolver,
    },
    loadComponent: () => import('./layouts/layout').then((m) => m.default),
    loadChildren: () =>
      import('./modules/admin/admin.routes').then((m) => m.adminRoutes),
  },
];
