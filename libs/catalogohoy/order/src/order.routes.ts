import { Routes } from '@angular/router';

export const ORDER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./presenter/views/order-list/order-list').then(
        (c) => c.OrderListComponent
      ),
  },
];
