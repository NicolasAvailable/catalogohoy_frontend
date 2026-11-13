import { Route } from '@angular/router';
import { EcommerceConfigComponent } from './presenter';
import { unsavedChangesGuard } from './presenter/ecommerce-config/unsaved-changes.guard';

export const ecommerceConfigRoutes: Route[] = [
  {
    // Editor a pantalla completa (CAT-103): menú lateral de secciones + vista
    // previa móvil/escritorio. El layout del admin oculta sidebar/navbar acá.
    path: 'edit',
    component: EcommerceConfigComponent,
    canDeactivate: [unsavedChangesGuard],
    data: { designMode: true },
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./presenter/create-catalog/create-catalog').then(
        (m) => m.CreateCatalog
      ),
  },
];
