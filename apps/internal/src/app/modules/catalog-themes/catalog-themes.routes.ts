import { Route } from '@angular/router';

export const catalogThemesRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./catalog-themes').then((m) => m.CatalogThemes),
  },
];
