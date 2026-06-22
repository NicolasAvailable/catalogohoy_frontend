import { Route } from '@angular/router';

export const couponsRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./coupons').then((m) => m.Coupons),
  },
];
