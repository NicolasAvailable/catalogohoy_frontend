import { Injectable, Type } from '@angular/core';
import { DynamicDialogConfig, DialogService as BaseDialogService } from 'primeng/dynamicdialog';
export { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { allowAutofocus } from '../focus';

export const dialogConfig = (input: DynamicDialogConfig = {}) => {
  return { dismissableMask: true, closable: true, modal: true, ...input };
};

@Injectable({ providedIn: 'root' })
export class DialogService extends BaseDialogService {
  // En móvil no enfocamos el primer input al abrir (abre el teclado).
  public override open<T>(componentType: Type<T>, config: DynamicDialogConfig) {
    return super.open(componentType, {
      focusOnShow: allowAutofocus(),
      ...config,
    });
  }

  public removeAll() {
    this.dialogComponentRefMap.forEach((dialog) => dialog.destroy());
  }
}
