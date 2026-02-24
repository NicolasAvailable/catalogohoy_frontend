import { Route } from '@angular/router';
import { EcommerceConfigComponent } from './presenter';

export const ecommerceConfigRoutes: Route[] = [
  {
    path: 'edit',
    component: EcommerceConfigComponent,
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./presenter/create-catalog/create-catalog').then(
        (m) => m.CreateCatalog
      ),
  },
];
