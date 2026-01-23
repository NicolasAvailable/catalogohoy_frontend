import { Routes } from '@angular/router';

export const categoryRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./views/list/list'),
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./views/edit/edit'),
  },
];
