import { Component, computed, input, output, signal, viewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { random } from '@shared/domain';
import { TranslatePipe } from '@shared/presenter';
import { ButtonComponent } from '../../button';
import { InputTextComponent } from '../../input';
import { ConfirmDialogComponent } from './confirm';

@Component({
  selector: 'ui-confirm-code-dialog',
  imports: [TranslatePipe, ButtonComponent, ReactiveFormsModule, InputTextComponent, ConfirmDialogComponent],
  template: `
    <ui-confirm-dialog
      #confirmDialog
      (confirm)="onConfirm()"
      (cancel)="cancel.emit()"
      [headerLabel]="headerLabel()"
      [acceptLabel]="acceptLabel()"
      [rejectLabel]="rejectLabel()"
      [contentLabel]="contentLabel()"
      [dismissableMask]="dismissableMask()"
      [closable]="closable()"
      [acceptDisabled]="!isValid()"
    >
      <content>
        <ng-content select="content" />
      </content>

      <div class="flex flex-col items-center justify-center gap-8 w-full mt-8">
        <p [innerHTML]="verificationLabel() | translate" class="text-lg"></p>

        <div class="flex items-center justify-center gap-8">
          <div class="text-5xl font-normal  tracking-wider">{{ currentVerificationCode() }}</div>
          <ui-button (click)="copyCode()" icon="copy" severity="contrast" size="small" styleClass="aspect-square" />
        </div>

        <form [formGroup]="form" class="flex justify-center items-center">
          <ui-input-text formControlName="code" [placeholder]="placeholder() | translate" styleClass="!w-80 !text-sm" />

          <ng-content />
        </form>
      </div>
    </ui-confirm-dialog>
  `,
})
export class ConfirmCodeDialogComponent {
  public readonly headerLabel = input.required<string>();
  public readonly acceptLabel = input.required<string>();
  public readonly rejectLabel = input.required<string>();
  public readonly contentLabel = input<string>('');
  public readonly verificationLabel = input<string>('UI.CONFIRM_DIALOG.REMOVE_CONFIRMATION_CODE_INSTRUCTION');
  public readonly placeholder = input<string>('UI.CONFIRM_DIALOG.REMOVE_CONFIRMATION_CODE_PLACEHOLDER');
  public readonly checkboxLabel = input<string>();
  public readonly verificationCode = input<string>();
  public readonly dismissableMask = input<boolean>(true);
  public readonly closable = input<boolean>(true);

  public readonly confirm = output<{ code: string; keepData?: boolean }>();
  public readonly cancel = output<void>();

  private readonly confirmDialog = viewChild.required<ConfirmDialogComponent>('confirmDialog');

  public readonly generatedCode = signal('');
  public readonly currentVerificationCode = computed(() => this.verificationCode() || this.generatedCode());

  public form: FormGroup;

  constructor(private readonly fb: FormBuilder) {
    this.form = this.fb.group({ code: ['', [Validators.required]], keepData: [false] });
    this.generateVerificationCode();
  }

  private generateVerificationCode(): void {
    this.generatedCode.set(random.int(10000, 99999).toString());
  }

  public isValid(): boolean {
    return this.form.valid && this.form.get('code')?.value === this.currentVerificationCode();
  }

  public copyCode(): void {
    navigator.clipboard.writeText(this.currentVerificationCode());
  }

  public onConfirm(): void {
    if (!this.isValid()) return;
    const { code, keepData } = this.form.value;
    this.confirm.emit({ code, keepData });
  }

  public warning() {
    this.confirmDialog().warning();
  }

  public error() {
    this.confirmDialog().error();
  }

  public info() {
    this.confirmDialog().info();
  }

  public success() {
    this.confirmDialog().success();
  }
}
