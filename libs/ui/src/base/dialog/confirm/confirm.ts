import { Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@shared/presenter';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ButtonComponent, ButtonSeverity } from '../../button/button';
import { IconComponent } from '../../icon/icon';

@Component({
  selector: 'ui-confirm-dialog',
  imports: [TranslatePipe, ButtonComponent, ConfirmDialogModule, IconComponent],
  providers: [ConfirmationService],
  template: `
    <p-confirmDialog
      #alert
      [draggable]="false"
      [closable]="closable()"
      [dismissableMask]="dismissableMask()"
      [styleClass]="'w-[43.7rem] ' + styleClass()"
    >
      <ng-template #header>
        <div class="flex items-center gap-5">
          <div [class]="headerBackground()" class="w-16 h-16 flex items-center justify-center rounded-full">
            <ui-icon [name]="icon()" [styleClass]="'w-8 h-8 ' + iconStyleClass()" />
          </div>
          <h2 class="font-bold text-2xl text-grey-800">
            {{ headerLabel() | translate : { target: target() | translate } }}
          </h2>
        </div>
      </ng-template>

      <ng-template #message>
        <section class="flex flex-col w-full">
          <ng-content select="content-top" />
          <div [class]="contentBackground()" class="w-full py-4 px-5 text-base rounded-base text-grey-800">
            @if(contentLabel()) {
            <p [innerHTML]="contentLabel() | translate"></p>
            }
            <ng-content select="content" />
          </div>
          <ng-content />
        </section>
      </ng-template>

      <ng-template #footer>
        <div class="flex justify-end gap-8">
          @if(rejectLabel()) {
          <ui-button (click)="alert.onReject()" [label]="rejectLabel() | translate" [severity]="'contrast'" />
          } @if(showAccept()) {
          <ui-button
            (click)="alert.onAccept()"
            [label]="acceptLabel() | translate"
            [severity]="severity()"
            [disabled]="acceptDisabled()"
          />
          }
        </div>
      </ng-template>
    </p-confirmDialog>
  `,
})
export class ConfirmDialogComponent {
  public readonly headerLabel = input<string>('GLOBAL.CONFIRM_DELETE_HEADER');
  public readonly target = input<string>('');
  public readonly contentLabel = input<string>('GLOBAL.CONFIRM_DELETE_CONTENT');
  public readonly acceptLabel = input<string>('GLOBAL.REMOVE');
  public readonly rejectLabel = input<string>('GLOBAL.CANCEL');
  public readonly showAccept = input<boolean>(true);
  public readonly dismissableMask = input<boolean>(true);
  public readonly closable = input<boolean>(true);
  public readonly acceptDisabled = input<boolean>(false);

  public readonly confirm = output<void>();
  public readonly cancel = output<void>();

  public readonly headerBackground = signal<string>('');
  public readonly contentBackground = signal<string>('');
  public readonly severity = signal<ButtonSeverity>('primary');
  public readonly icon = signal<string>('');
  public readonly iconStyleClass = signal<string>('');
  public readonly styleClass = signal<string>('');

  constructor(private readonly confirmationService: ConfirmationService) {}

  public open() {
    this.confirmationService.confirm({ accept: () => this.confirm.emit(), reject: () => this.cancel.emit() });
  }

  public success() {
    this.severity.set('success');
    this.headerBackground.set('bg-green-50');
    this.contentBackground.set('bg-white-600');
    this.icon.set('circle-check-big');
    this.iconStyleClass.set('text-green-500');
    this.open();
  }

  public info() {
    this.severity.set('primary');
    this.headerBackground.set('bg-primary-50');
    this.contentBackground.set('bg-white-600');
    this.icon.set('info');
    this.iconStyleClass.set('text-primary-500');
    this.open();
  }

  public warning() {
    this.severity.set('danger');
    this.headerBackground.set('bg-secondary-50');
    this.contentBackground.set('bg-secondary-50');
    this.icon.set('triangle-alert');
    this.iconStyleClass.set('text-secondary-500');
    this.open();
  }

  public error() {
    this.severity.set('danger');
    this.headerBackground.set('bg-red-50');
    this.contentBackground.set('bg-red-50');
    this.icon.set('circle-x');
    this.iconStyleClass.set('text-red-500');
    this.open();
  }
}
