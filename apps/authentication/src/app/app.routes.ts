import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./layouts/layout'),
    children: [
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
      {
        path: 'login',
        loadComponent: () => import('@catalogohoy/auth').then((m) => m.Login),
      },
      {
        path: 'signup',
        loadComponent: () => import('@catalogohoy/auth').then((m) => m.Signup),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('@catalogohoy/auth').then((m) => m.ForgottenPassword),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('@catalogohoy/auth').then((m) => m.ResetPassword),
      },
      {
        path: 'confirm-email',
        loadComponent: () =>
          import('@catalogohoy/auth').then((m) => m.ConfirmEmail),
      },
    ],
  },
  {
    path: 'accept-invite',
    loadComponent: () =>
      import('@catalogohoy/auth').then((m) => m.AcceptInviteComponent),
  },
  {
    path: '**',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
