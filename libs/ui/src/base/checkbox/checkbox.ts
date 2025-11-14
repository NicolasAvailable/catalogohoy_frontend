import { CommonModule } from '@angular/common';
import { Component, forwardRef, input, output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';

@Component({
  selector: 'ui-checkbox',
  imports: [CommonModule, FormsModule, CheckboxModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
  template: `
    <p-checkbox
      [(ngModel)]="value"
      (ngModelChange)="change($event)"
      [inputId]="checkboxId()"
      [binary]="true"
      [size]="size()"
      [disabled]="disabled()"
    />
  `,
})
export class CheckboxComponent implements ControlValueAccessor {
  public readonly checkboxId = input<string>('');
  public readonly size = input<'small' | 'large' | any>(undefined);
  public readonly disabled = input<boolean>(false);
  public readonly styleClass = input<string>('');

  public readonly valueChange = output<boolean>();

  public value = false;

  private onChange: (value: boolean) => void = () => {
    /* This will be overridden by registerOnChange */
  };

  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: boolean): void {
    this.value = value;
  }

  public registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public change(value: boolean) {
    if (this.disabled()) return;
    this.value = value;
    this.valueChange.emit(this.value);
    this.onChange(this.value);
    this.onTouched();
  }
}
