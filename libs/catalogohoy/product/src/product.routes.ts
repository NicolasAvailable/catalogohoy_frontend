import { Route } from '@angular/router';
import { Product } from './presenter';

export const productRoutes: Route[] = [
  {
    path: '',
    component: Product,
    children: [
      {
        path: '',
        loadComponent: () => import('./presenter/views/list/list'),
      },
      {
        path: 'create',
        loadComponent: () => import('./presenter/views/save/save'),
      },
      {
        path: 'edit/:id',
        loadComponent: () => import('./presenter/views/save/save'),
      },
    ],
  },
];
