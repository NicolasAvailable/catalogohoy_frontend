import { Injectable } from '@angular/core';
import { DynamicDialogConfig, DialogService as BaseDialogService } from 'primeng/dynamicdialog';
export { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

export const dialogConfig = (input: DynamicDialogConfig = {}) => {
  return { dismissableMask: true, closable: true, modal: true, ...input };
};

@Injectable({ providedIn: 'root' })
export class DialogService extends BaseDialogService {
  public removeAll() {
    this.dialogComponentRefMap.forEach((dialog) => dialog.destroy());
  }
}
