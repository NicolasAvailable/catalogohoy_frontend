import { Routes } from '@angular/router';

export const CLIENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./presenter/views/client-list/client-list'),
  },
  {
    path: ':phone',
    loadComponent: () =>
      import('./presenter/views/client-detail/client-detail'),
  },
];
