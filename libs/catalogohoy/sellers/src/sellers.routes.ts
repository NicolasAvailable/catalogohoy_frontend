import { Routes } from '@angular/router';

export const SELLERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./presenter/views/seller-list/seller-list'),
  },
];
