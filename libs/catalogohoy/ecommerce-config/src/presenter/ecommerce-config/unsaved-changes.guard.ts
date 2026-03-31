import { CanDeactivateFn } from '@angular/router';
import { EcommerceConfigComponent } from './ecommerce-config';

export const unsavedChangesGuard: CanDeactivateFn<EcommerceConfigComponent> = (
  component
) => {
  if (!component.hasUnsavedChanges()) return true;
  return component.showUnsavedChangesDialog();
};
