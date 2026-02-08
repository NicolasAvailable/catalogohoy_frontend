import { Route } from '@angular/router';

export const adminRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('@catalogohoy/home').then((m) => m.Home),
  },
  {
    path: 'products',
    loadChildren: () =>
      import('@catalogohoy/product').then((m) => m.productRoutes),
  },
  {
    path: 'profile',
    loadComponent: () => import('@catalogohoy/profile').then((m) => m.Profile),
  },
  {
    path: 'categories',
    loadChildren: () =>
      import('@catalogohoy/category').then((m) => m.categoryRoutes),
  },
  {
    path: 'orders',
    loadChildren: () =>
      import('@catalogohoy/order').then((m) => m.ORDER_ROUTES),
  },
  {
    path: 'exchange-rates',
    loadChildren: () => import('@catalogohoy/rate').then((m) => m.RATE_ROUTES),
  },
];
