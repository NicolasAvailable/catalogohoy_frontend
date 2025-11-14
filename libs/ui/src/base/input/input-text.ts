import { CommonModule } from '@angular/common';
import { Component, forwardRef, Injector, input, OnInit, signal } from '@angular/core';
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
      [ngClass]="{ 'ng-invalid ng-dirty': control?.invalid && (control?.dirty || control?.touched) }"
    />
  `,
})
export class InputTextComponent implements OnInit, ControlValueAccessor {
  public readonly inputId = input('');
  public readonly size = input<'small' | 'large' | any>(undefined);
  public readonly placeholder = input('');
  public readonly styleClass = input('');

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
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }

  public clear() {
    this.value.set('');
    this.onChange('');
    this.onTouched();
  }
}
