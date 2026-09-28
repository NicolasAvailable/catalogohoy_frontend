import { Routes } from '@angular/router';

export const ORDER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./presenter/views/order-list/order-list').then(
        (c) => c.OrderListComponent
      ),
  },
  {
    path: 'create',
    loadComponent: () => import('./presenter/views/order-save/order-save'),
  },
  {
    // "Registrar venta" (venta en tienda): mismo form en modo venta. Se usa
    // route `data` en vez de query param porque el bootstrap del tenant/slug
    // redirige y descarta los query params.
    path: 'create-venta',
    data: { mode: 'venta' },
    loadComponent: () => import('./presenter/views/order-save/order-save'),
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./presenter/views/order-save/order-save'),
  },
];
