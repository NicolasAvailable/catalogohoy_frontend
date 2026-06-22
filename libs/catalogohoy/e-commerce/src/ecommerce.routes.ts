import { Route } from '@angular/router';
import { ECommerce } from './presenter';

export const ecommerceRoutes: Route[] = [
  {
    path: '',
    component: ECommerce,
    children: [
      {
        path: '',
        loadComponent: () => import('./presenter/views/catalog/catalog'),
      },
      {
        path: 'product/:id',
        loadComponent: () =>
          import('./presenter/views/product-detail/product-detail'),
      },
      {
        path: 'checkout',
        loadComponent: () => import('./presenter/views/checkout/checkout'),
      },
      {
        path: 'order/:id/invoice',
        loadComponent: () => import('./presenter/views/invoice/invoice'),
      },
    ],
  },
];
