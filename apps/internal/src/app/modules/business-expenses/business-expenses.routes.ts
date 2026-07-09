import { Route } from '@angular/router';

export const businessExpensesRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./business-expenses').then((m) => m.BusinessExpenses),
  },
];
