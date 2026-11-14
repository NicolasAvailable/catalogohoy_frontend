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
        // Edición masiva tipo Excel (CAT-76). Avisa antes de salir con cambios
        // sin guardar.
        path: 'bulk-edit',
        loadComponent: () => import('./presenter/views/bulk-edit/bulk-edit'),
        canDeactivate: [(c: { canLeave?: () => boolean }) => c.canLeave?.() ?? true],
      },
      {
        path: 'edit/:id',
        loadComponent: () => import('./presenter/views/save/save'),
      },
    ],
  },
];
