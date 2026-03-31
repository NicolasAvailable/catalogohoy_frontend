import { Route } from '@angular/router';
import { EcommerceConfigComponent } from './presenter';
import { unsavedChangesGuard } from './presenter/ecommerce-config/unsaved-changes.guard';

export const ecommerceConfigRoutes: Route[] = [
  {
    path: 'edit',
    component: EcommerceConfigComponent,
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./presenter/create-catalog/create-catalog').then(
        (m) => m.CreateCatalog
      ),
  },
];
