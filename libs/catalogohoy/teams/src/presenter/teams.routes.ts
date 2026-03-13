import { Route } from '@angular/router';

export const TEAMS_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./views/teams-view/teams-view').then((m) => m.default),
  },
];
