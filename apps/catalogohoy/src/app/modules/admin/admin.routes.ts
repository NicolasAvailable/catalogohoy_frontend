import { Route } from '@angular/router';

export const adminRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('@catalogohoy/home').then((m) => m.Home),
  },
  {
    path: 'products',
    loadComponent: () => import('@catalogohoy/product').then((m) => m.Product),
  },
  {
    path: 'profile',
    loadComponent: () => import('@catalogohoy/profile').then((m) => m.Profile),
  },
];
