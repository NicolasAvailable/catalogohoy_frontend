import { Route, Router } from '@angular/router';
import { inject } from '@angular/core';
import { isNativeApp } from '@catalogohoy/core';

/** Checkout/success/terms son vistas de Stripe (pago web): quedan web-only. En
 *  nativo (iOS y Android) la compra es por IAP vía la paywall (ruta ''). */
const webOnlyGuard = () =>
  isNativeApp() ? inject(Router).createUrlTree(['/admin']) : true;

export const planRoutes: Route[] = [
  {
    path: '',
    // Nativo (iOS + Android) → paywall de compra IAP (RevenueCat); web → página
    // de planes de Stripe.
    loadComponent: () =>
      isNativeApp()
        ? import('./presenter/iap-paywall/iap-paywall').then((m) => m.IapPaywall)
        : import('./presenter/plans/plans').then((m) => m.Plans),
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
    // Los T&C describen precios de planes (sección "Planes y Pagos"): también
    // web-only para que no sean alcanzables por URL directa en nativo.
    canActivate: [webOnlyGuard],
    loadComponent: () =>
      import('./presenter/terms/terms').then((m) => m.Terms),
  },
];
