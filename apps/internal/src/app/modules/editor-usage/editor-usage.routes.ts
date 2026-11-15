import { Route } from '@angular/router';

export const editorUsageRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./editor-usage').then((m) => m.EditorUsage),
  },
];
