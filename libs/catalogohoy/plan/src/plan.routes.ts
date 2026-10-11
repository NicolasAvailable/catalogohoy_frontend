import { inject } from '@angular/core';
import { Route, Router } from '@angular/router';
import { isNativeApp } from '@catalogohoy/core';

/** Compliance IAP (Apple 3.1.1): en la app nativa no existe compra de planes,
 *  así que las vistas de planes/checkout quedan inalcanzables (solo web). */
const webOnlyGuard = () =>
  isNativeApp() ? inject(Router).createUrlTree(['/admin']) : true;

export const planRoutes: Route[] = [
  {
    path: '',
    canActivate: [webOnlyGuard],
    loadComponent: () =>
      import('./presenter/plans/plans').then((m) => m.Plans),
  },
  {
    path: 'checkout/:planId',
    canActivate: [webOnlyGuard],
    loadComponent: () =>
      import('./presenter/plan-checkout/plan-checkout').then(
        (m) => m.PlanCheckout
      ),
  },
  {
    path: 'success',
    canActivate: [webOnlyGuard],
    loadComponent: () =>
      import('./presenter/plan-success/plan-success').then((m) => m.PlanSuccess),
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./presenter/terms/terms').then((m) => m.Terms),
  },
];
