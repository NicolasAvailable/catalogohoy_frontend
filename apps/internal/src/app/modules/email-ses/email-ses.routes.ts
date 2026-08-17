import { Route } from '@angular/router';

export const emailSesRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./email-ses').then((m) => m.EmailSes),
  },
];
