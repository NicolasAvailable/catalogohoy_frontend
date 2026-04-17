import { Route } from '@angular/router';
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
    path: 'clients',
    canActivate: [teamPermissionGuard('clientes', 'view')],
    loadChildren: () =>
      import('@catalogohoy/client').then((m) => m.CLIENT_ROUTES),
  },
  {
    path: 'exchange-rates',
    canActivate: [teamPermissionGuard('tasas', 'edit')],
    loadChildren: () => import('@catalogohoy/rate').then((m) => m.RATE_ROUTES),
  },
  {
    path: 'catalog',
    canActivate: [teamPermissionGuard('catalogo', 'edit')],
    loadChildren: () =>
      import('@catalogohoy/ecommerce-config').then(
        (m) => m.ecommerceConfigRoutes
      ),
  },
  {
    path: 'new-catalog',
    loadComponent: () =>
      import('@catalogohoy/ecommerce-config').then((m) => m.CreateCatalog),
  },
  {
    path: 'plans',
    loadChildren: () =>
      import('@catalogohoy/plan').then((m) => m.planRoutes),
  },
  {
    path: 'analytics',
    // Free-plan users can enter — the view renders a premium-upgrade prompt
    // instead of the dashboard, so they discover what they're missing.
    canActivate: [teamPermissionGuard('analiticas', 'view')],
    loadChildren: () =>
      import('@catalogohoy/analytics').then((m) => m.ANALYTICS_ROUTES),
  },
  {
    path: 'teams',
    // Same: free plan can see the list + history, but invite button is
    // disabled and empty state nudges them to upgrade.
    canActivate: [teamPermissionGuard('equipo', 'view')],
    children: TEAMS_ROUTES,
  },
];
