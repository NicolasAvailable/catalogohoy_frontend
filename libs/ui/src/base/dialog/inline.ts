import { Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@shared/presenter';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'ui-dialog',
  imports: [TranslatePipe, DialogModule],
  template: `
    <p-dialog
      (onShow)="open.emit()"
      (onHide)="close.emit()"
      [(visible)]="visible"
      [modal]="modal()"
      [draggable]="false"
      [header]="headerTitle() | translate"
      [showHeader]="showHeader()"
      [closable]="closable()"
      [closeOnEscape]="closeOnEscape()"
      [dismissableMask]="dismissableMask()"
      [styleClass]="styleClass()"
      [resizable]="false"
      [appendTo]="appendTo()"
    >
      <ng-content />
    </p-dialog>
  `,
})
export class DialogComponent {
  public readonly headerTitle = input('');
  public readonly showHeader = input(true);
  public readonly closeOnEscape = input(true);
  public readonly modal = input(true);
  public readonly closable = input(true);
  public readonly dismissableMask = input(true);
  public readonly appendTo = input<HTMLElement | string | null | undefined>('body');
  public readonly styleClass = input('');

  public readonly close = output<void>();
  public readonly open = output<void>();

  public readonly visible = signal(false);

  public readonly isOpen = computed(() => this.visible());

  public show() {
    this.visible.set(true);
  }

  public hide() {
    this.visible.set(false);
  }
}
