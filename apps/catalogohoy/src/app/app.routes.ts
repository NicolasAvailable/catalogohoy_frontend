import { Route } from '@angular/router';
import { profileResolver } from '@catalogohoy/profile';
import { isValidSlugGuard } from '@catalogohoy/tenant';

export const appRoutes: Route[] = [
  {
    path: '',
    canActivate: [isValidSlugGuard],
    loadComponent: () =>
      import('@catalogohoy/e-commerce').then((m) => m.ECommerce),
  },
  {
    path: 'admin',
    canActivate: [isValidSlugGuard],
    resolve: {
      profile: profileResolver,
    },
    loadComponent: () => import('./layouts/layout').then((m) => m.default),
    loadChildren: () =>
      import('./modules/admin/admin.routes').then((m) => m.adminRoutes),
  },
];
