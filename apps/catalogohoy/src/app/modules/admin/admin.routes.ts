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
    canActivate: [teamPermissionGuard('productos', 'view')],
    loadChildren: () =>
      import('@catalogohoy/product').then((m) => m.productRoutes),
  },
  {
    path: 'profile',
    loadComponent: () => import('@catalogohoy/profile').then((m) => m.Profile),
  },
  {
    path: 'categories',
    canActivate: [teamPermissionGuard('productos', 'view')],
    loadChildren: () =>
      import('@catalogohoy/category').then((m) => m.categoryRoutes),
  },
  {
    path: 'orders',
    canActivate: [teamPermissionGuard('ordenes', 'view')],
    loadChildren: () =>
      import('@catalogohoy/order').then((m) => m.ORDER_ROUTES),
  },
  {
    path: 'exchange-rates',
    canActivate: [teamPermissionGuard('tasas', 'view')],
    loadChildren: () => import('@catalogohoy/rate').then((m) => m.RATE_ROUTES),
  },
  {
    path: 'catalog',
    canActivate: [teamPermissionGuard('catalogo', 'view')],
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
    canActivate: [freePlanGuard, teamPermissionGuard('equipo', 'view')],
    children: TEAMS_ROUTES,
  },
];
