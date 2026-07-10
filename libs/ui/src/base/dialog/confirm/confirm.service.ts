import { Injectable, ComponentRef, ApplicationRef, inject, createComponent, EnvironmentInjector } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, Subject } from 'rxjs';
import { E } from '@shared/domain';
import { ConfirmDialogComponent } from './confirm';

export type ConfirmDialogConfig = {
  headerLabel?: string;
  target?: string;
  contentLabel?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  rejectSeverity?: string;
  showAccept?: boolean;
  dismissableMask?: boolean;
  closable?: boolean;
  styleClass?: string;
  onClose?: () => void;
};

export type ConfirmDialogResult = E.Either<void, void>;

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly applicationRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  // Igual que el toaster: los labels se traducen acá (key-as-text), así los
  // call sites siguen pasando el texto en español sin tocar nada.
  private readonly transloco = inject(TranslocoService);

  private activeDialog?: ComponentRef<ConfirmDialogComponent>;

  public success(config: ConfirmDialogConfig = {}): Observable<ConfirmDialogResult> {
    return this.openDialog(config, 'success');
  }

  public info(config: ConfirmDialogConfig = {}): Observable<ConfirmDialogResult> {
    return this.openDialog(config, 'info');
  }

  public warning(config: ConfirmDialogConfig = {}): Observable<ConfirmDialogResult> {
    return this.openDialog(config, 'warning');
  }

  public error(config: ConfirmDialogConfig = {}): Observable<ConfirmDialogResult> {
    return this.openDialog(config, 'error');
  }

  private openDialog(
    config: ConfirmDialogConfig,
    type: 'success' | 'info' | 'warning' | 'error'
  ): Observable<ConfirmDialogResult> {
    this.closeDialog();

    this.activeDialog = this.createDialogComponent();
    const dialogInstance = this.activeDialog.instance;

    config.headerLabel && this.activeDialog.setInput('headerLabel', this.transloco.translate(config.headerLabel));
    config.target && this.activeDialog.setInput('target', config.target);
    config.acceptLabel && this.activeDialog.setInput('acceptLabel', this.transloco.translate(config.acceptLabel));
    config.rejectLabel && this.activeDialog.setInput('rejectLabel', this.transloco.translate(config.rejectLabel));
    config.contentLabel && this.activeDialog.setInput('contentLabel', this.transloco.translate(config.contentLabel));
    config.showAccept !== undefined && this.activeDialog.setInput('showAccept', config.showAccept);
    config.dismissableMask !== undefined && this.activeDialog.setInput('dismissableMask', config.dismissableMask);
    config.closable !== undefined && this.activeDialog.setInput('closable', config.closable);
    config.rejectSeverity && this.activeDialog.setInput('rejectSeverity', config.rejectSeverity);
    config.styleClass && this.activeDialog.setInput('styleClass', config.styleClass);

    const resultSubject = new Subject<ConfirmDialogResult>();
    let handled = false;

    const cleanup = () => {
      confirmSub.unsubscribe();
      cancelSub.unsubscribe();
      closeSub.unsubscribe();
      setTimeout(() => this.closeDialog());
    };

    const confirmSub = dialogInstance.confirm.subscribe(() => {
      if (handled) return;
      handled = true;
      resultSubject.next(E.right(undefined));
      resultSubject.complete();
      cleanup();
    });

    const cancelSub = dialogInstance.cancel.subscribe(() => {
      if (handled) return;
      handled = true;
      resultSubject.next(E.left(undefined));
      resultSubject.complete();
      cleanup();
    });

    const closeSub = dialogInstance.close.subscribe(() => {
      if (handled) return;
      handled = true;
      config.onClose?.();
      resultSubject.complete();
      cleanup();
    });

    switch (type) {
      case 'success':
        dialogInstance.success();
        break;
      case 'info':
        dialogInstance.info();
        break;
      case 'warning':
        dialogInstance.warning();
        break;
      case 'error':
        dialogInstance.error();
        break;
    }

    return resultSubject.asObservable();
  }

  private createDialogComponent(): ComponentRef<ConfirmDialogComponent> {
    const componentRef = createComponent(ConfirmDialogComponent, { environmentInjector: this.environmentInjector });

    this.applicationRef.attachView(componentRef.hostView);
    const domElement = (componentRef.hostView as any).rootNodes[0] as HTMLElement;
    this.document.body.appendChild(domElement);

    return componentRef;
  }

  private closeDialog(): void {
    if (!this.activeDialog) return;
    this.applicationRef.detachView(this.activeDialog.hostView);
    const domElement = (this.activeDialog.hostView as any).rootNodes[0] as HTMLElement;
    if (domElement && domElement.parentNode) domElement.parentNode.removeChild(domElement);
    this.activeDialog.destroy();
    this.activeDialog = undefined;
  }
}
