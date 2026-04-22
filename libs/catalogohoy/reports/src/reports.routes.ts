import { Route } from '@angular/router';
import { teamPermissionGuard } from '@catalogohoy/teams';

export const REPORTS_ADMIN_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () => import('./presenter/list/list'),
  },
  {
    path: 'new',
    // Extra guard: only members with reportes:create can reach the form.
    canActivate: [teamPermissionGuard('reportes', 'create')],
    loadComponent: () => import('./presenter/create/create'),
  },
  {
    path: ':id',
    loadComponent: () => import('./presenter/detail/detail'),
  },
];

export const REPORTS_PUBLIC_ROUTES: Route[] = [
  {
    path: ':token',
    loadComponent: () => import('./presenter/public-detail/public-detail'),
  },
];
