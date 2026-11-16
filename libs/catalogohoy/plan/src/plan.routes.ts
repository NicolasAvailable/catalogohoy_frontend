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
    // Vuelta de Stripe tras comprar un dominio (Editar catálogo / Perfil → Dominio).
    path: 'domain-success',
    loadComponent: () =>
      import('./presenter/domain-success/domain-success').then((m) => m.DomainSuccess),
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./presenter/terms/terms').then((m) => m.Terms),
  },
];
