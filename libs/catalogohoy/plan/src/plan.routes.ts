import { Route } from '@angular/router';

export const planRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./presenter/plans/plans').then((m) => m.Plans),
  },
  {
    path: 'checkout/:planId',
    loadComponent: () =>
      import('./presenter/plan-checkout/plan-checkout').then(
        (m) => m.PlanCheckout
      ),
  },
  {
    path: 'success',
    loadComponent: () =>
      import('./presenter/plan-success/plan-success').then((m) => m.PlanSuccess),
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./presenter/terms/terms').then((m) => m.Terms),
  },
];
