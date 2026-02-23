import { Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@shared/presenter';
import { DialogModule } from 'primeng/dialog';
import { IconComponent } from '../icon/icon';

@Component({
  selector: 'ui-dialog',
  imports: [TranslatePipe, DialogModule, IconComponent],
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
      [styleClass]="computedStyleClass()"
      [resizable]="false"
      [appendTo]="appendTo()"
    >
      @if (closable() && visible()) {
        <button
          (click)="hide()"
          class="absolute top-4 left-4 z-10 flex items-center justify-center w-8 h-8 rounded-full hover:bg-grey-50 transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <ui-icon name="x" size="20" styleClass="text-grey-700" />
        </button>
      }
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

  public readonly computedStyleClass = computed(() => {
    const base = this.styleClass();
    return this.closable()
      ? `${base} [&_.p-dialog-close-button]:hidden`.trim()
      : base;
  });

  public show() {
    this.visible.set(true);
  }

  public hide() {
    this.visible.set(false);
  }
}
