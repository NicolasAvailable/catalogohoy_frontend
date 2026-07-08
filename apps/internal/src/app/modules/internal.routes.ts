import { Route } from '@angular/router';

export const internalRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'tenants',
    loadChildren: () =>
      import('./tenants/tenants.routes').then((m) => m.tenantsRoutes),
  },
  {
    path: 'users',
    loadChildren: () =>
      import('./users/users.routes').then((m) => m.usersRoutes),
  },
  {
    path: 'paying-clients',
    loadChildren: () =>
      import('./paying-clients/paying-clients.routes').then(
        (m) => m.payingClientsRoutes
      ),
  },
  {
    path: 'paying-accounts',
    loadChildren: () =>
      import('./paying-accounts/paying-accounts.routes').then(
        (m) => m.payingAccountsRoutes
      ),
  },
  {
    path: 'enterprise-leads',
    loadChildren: () =>
      import('./enterprise-leads/enterprise-leads.routes').then(
        (m) => m.enterpriseLeadsRoutes
      ),
  },
  {
    path: 'whatsapp-logs',
    loadChildren: () =>
      import('./whatsapp-logs/whatsapp-logs.routes').then(
        (m) => m.whatsappLogsRoutes
      ),
  },
  {
    path: 'ai-usage',
    loadChildren: () =>
      import('./ai-usage/ai-usage.routes').then((m) => m.aiUsageRoutes),
  },
  {
    path: 'coupons',
    loadChildren: () =>
      import('./coupons/coupons.routes').then((m) => m.couponsRoutes),
  },
  {
    path: 'orders',
    loadChildren: () =>
      import('./platform-orders/platform-orders.routes').then(
        (m) => m.platformOrdersRoutes
      ),
  },
];
