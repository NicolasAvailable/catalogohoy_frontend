import { CommonModule } from '@angular/common';
import { Component, forwardRef, Injector, input, OnInit, output, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, NgControl } from '@angular/forms';
import { TranslatePipe } from '@shared/presenter';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'ui-input-text',
  imports: [CommonModule, InputTextModule, TranslatePipe, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputTextComponent),
      multi: true,
    },
  ],
  template: `
    <input
      pInputText
      (ngModelChange)="change($event)"
      [ngModel]="value()"
      [id]="inputId()"
      [placeholder]="placeholder() | translate"
      [disabled]="disabled()"
      [pSize]="size()"
      [fluid]="true"
      [class]="styleClass()"
      [ngClass]="{ 'ng-invalid ng-dirty': invalid() || (control?.invalid && (control?.dirty || control?.touched)) }"
      [attr.inputmode]="digitsOnly() ? 'numeric' : null"
      (keypress)="onKeypress($event)"
      (blur)="onBlur()"
    />
  `,
})
export class InputTextComponent implements OnInit, ControlValueAccessor {
  public readonly inputId = input('');
  public readonly size = input<'small' | 'large' | any>(undefined);
  public readonly placeholder = input('');
  public readonly styleClass = input('');
  /** Fuerza el estado de error (borde rojo) desde afuera — para forms basados
   *  en signals/ngModel sin validators, donde `control.invalid` nunca aplica. */
  public readonly invalid = input<boolean>(false);
  /** Blur del input interno — permite marcar "touched" en forms de signals. */
  public readonly inputBlur = output<void>();
  /** Solo dígitos: bloquea letras al tipear, limpia lo pegado y activa el
   *  teclado numérico en mobile (inputmode). Para teléfonos, cédulas, etc. */
  public readonly digitsOnly = input<boolean>(false);

  public readonly value = signal<string>('');
  public readonly disabled = signal(false);

  public control: NgControl | null = null;

  constructor(private readonly injector: Injector) {}

  ngOnInit(): void {
    this.control = this.injector.get(NgControl, null) as NgControl;
    this.control.valueAccessor = this;
  }

  private onChange: (value: string) => void = () => {
    /* This will be overridden by registerOnChange */
  };
  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: string): void {
    this.value.set(value);
  }

  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  public change(value: string) {
    const v = this.digitsOnly() ? (value ?? '').replace(/\D+/g, '') : value;
    this.value.set(v);
    this.onChange(v);
    this.onTouched();
  }

  public onKeypress(event: KeyboardEvent) {
    if (this.digitsOnly() && event.key.length === 1 && !/[0-9]/.test(event.key)) {
      event.preventDefault();
    }
  }

  public onBlur() {
    this.onTouched();
    this.inputBlur.emit();
  }

  public clear() {
    this.value.set('');
    this.onChange('');
    this.onTouched();
  }
}
