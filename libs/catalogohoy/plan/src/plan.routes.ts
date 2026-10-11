import { inject } from '@angular/core';
import { Route, Router } from '@angular/router';
import { isAndroidApp, isIosApp, isNativeApp } from '@catalogohoy/core';

/** Planes/checkout/success: en iOS la compra es por IAP (paywall propia, ver la
 *  ruta ''), así que estas vistas de Stripe quedan web-only. En Android todavía
 *  no hay billing → también redirigen al admin. */
const webOnlyGuard = () =>
  isNativeApp() ? inject(Router).createUrlTree(['/admin']) : true;

/** La página de planes raíz: en web es la página de Stripe y en iOS la paywall
 *  de IAP (RevenueCat); solo Android (sin billing todavía) se redirige. */
const plansRootGuard = () =>
  isAndroidApp() ? inject(Router).createUrlTree(['/admin']) : true;

export const planRoutes: Route[] = [
  {
    path: '',
    canActivate: [plansRootGuard],
    // iOS → paywall de compra IAP; web → página de planes de Stripe.
    loadComponent: () =>
      isIosApp()
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
