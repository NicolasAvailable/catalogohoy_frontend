import { Route } from '@angular/router';
import { teamPermissionGuard, TEAMS_ROUTES } from '@catalogohoy/teams';
import { chatEnabledGuard } from './chat-enabled.guard';

export const adminRoutes: Route[] = [
  {
    path: '',
    title: 'Inicio',
    loadComponent: () => import('@catalogohoy/home').then((m) => m.Home),
  },
  {
    path: 'products',
    title: 'Productos',
    canActivate: [teamPermissionGuard('productos', 'view')],
    loadChildren: () =>
      import('@catalogohoy/product').then((m) => m.productRoutes),
  },
  {
    path: 'profile',
    title: 'Mi perfil',
    loadComponent: () => import('@catalogohoy/profile').then((m) => m.Profile),
  },
  {
    path: 'referrals',
    title: 'Referidos',
    loadComponent: () =>
      import('@catalogohoy/profile').then((m) => m.ReferralPanel),
  },
  {
    path: 'categories',
    title: 'Categorías',
    canActivate: [teamPermissionGuard('productos', 'view')],
    loadChildren: () =>
      import('@catalogohoy/category').then((m) => m.categoryRoutes),
  },
  {
    path: 'orders',
    title: 'Órdenes',
    canActivate: [teamPermissionGuard('ordenes', 'view')],
    loadChildren: () =>
      import('@catalogohoy/order').then((m) => m.ORDER_ROUTES),
  },
  {
    path: 'clients',
    title: 'Clientes',
    canActivate: [teamPermissionGuard('clientes', 'view')],
    loadChildren: () =>
      import('@catalogohoy/client').then((m) => m.CLIENT_ROUTES),
  },
  {
    path: 'exchange-rates',
    title: 'Tasas del día',
    canActivate: [teamPermissionGuard('tasas', 'edit')],
    loadChildren: () => import('@catalogohoy/rate').then((m) => m.RATE_ROUTES),
  },
  {
    path: 'catalog',
    title: 'Editar catálogo',
    canActivate: [teamPermissionGuard('catalogo', 'edit')],
    loadChildren: () =>
      import('@catalogohoy/ecommerce-config').then(
        (m) => m.ecommerceConfigRoutes
      ),
  },
  {
    path: 'new-catalog',
    title: 'Nuevo catálogo',
    loadComponent: () =>
      import('@catalogohoy/ecommerce-config').then((m) => m.CreateCatalog),
  },
  {
    path: 'plans',
    title: 'Planes',
    loadChildren: () =>
      import('@catalogohoy/plan').then((m) => m.planRoutes),
  },
  {
    path: 'analytics',
    title: 'Analíticas',
    // Free-plan users can enter — the view renders a premium-upgrade prompt
    // instead of the dashboard, so they discover what they're missing.
    canActivate: [teamPermissionGuard('analiticas', 'view')],
    loadChildren: () =>
      import('@catalogohoy/analytics').then((m) => m.ANALYTICS_ROUTES),
  },
  {
    path: 'reports',
    title: 'Reportes',
    canActivate: [teamPermissionGuard('reportes', 'view')],
    loadChildren: () =>
      import('@catalogohoy/reports').then((m) => m.REPORTS_ADMIN_ROUTES),
  },
  {
    path: 'teams',
    title: 'Equipo',
    // Same: free plan can see the list + history, but invite button is
    // disabled and empty state nudges them to upgrade.
    canActivate: [teamPermissionGuard('equipo', 'view')],
    children: TEAMS_ROUTES,
  },
  {
    path: 'chat',
    title: 'Chat',
    canActivate: [chatEnabledGuard],
    loadChildren: () => import('@catalogohoy/chat').then((m) => m.CHAT_ROUTES),
  },
];
