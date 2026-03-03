import { Route } from '@angular/router';
import { freePlanGuard } from '@catalogohoy/plan';
import { teamPermissionGuard, TEAMS_ROUTES } from '@catalogohoy/teams';

export const adminRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('@catalogohoy/home').then((m) => m.Home),
  },
  {
    path: 'products',
    loadChildren: () =>
      import('@catalogohoy/product').then((m) => m.productRoutes),
  },
  {
    path: 'profile',
    loadComponent: () => import('@catalogohoy/profile').then((m) => m.Profile),
  },
  {
    path: 'categories',
    loadChildren: () =>
      import('@catalogohoy/category').then((m) => m.categoryRoutes),
  },
  {
    path: 'orders',
    loadChildren: () =>
      import('@catalogohoy/order').then((m) => m.ORDER_ROUTES),
  },
  {
    path: 'exchange-rates',
    loadChildren: () => import('@catalogohoy/rate').then((m) => m.RATE_ROUTES),
  },
  {
    path: 'catalog',
    loadChildren: () =>
      import('@catalogohoy/ecommerce-config').then(
        (m) => m.ecommerceConfigRoutes
      ),
  },
  {
    path: 'plans',
    loadChildren: () =>
      import('@catalogohoy/plan').then((m) => m.planRoutes),
  },
  {
    path: 'analytics',
    canActivate: [freePlanGuard, teamPermissionGuard('analiticas', 'view')],
    loadChildren: () =>
      import('@catalogohoy/analytics').then((m) => m.ANALYTICS_ROUTES),
  },
  {
    path: 'teams',
    canActivate: [freePlanGuard],
    children: TEAMS_ROUTES,
  },
];
