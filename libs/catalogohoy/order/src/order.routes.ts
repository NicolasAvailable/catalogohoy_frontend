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
    path: 'edit/:id',
    loadComponent: () => import('./presenter/views/order-save/order-save'),
  },
];
