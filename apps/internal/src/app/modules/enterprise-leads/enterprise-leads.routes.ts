import { Route } from '@angular/router';

export const enterpriseLeadsRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./enterprise-leads').then((m) => m.EnterpriseLeads),
  },
];
