import { CommonModule } from '@angular/common';
import { Component, forwardRef, input } from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { RadioButtonModule } from 'primeng/radiobutton';

@Component({
  selector: 'ui-radio-button',
  imports: [CommonModule, FormsModule, RadioButtonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RadioButtonComponent),
      multi: true,
    },
  ],
  template: `
    <p-radiobutton
      [(ngModel)]="value"
      (ngModelChange)="change($event)"
      [inputId]="inputId()"
      [name]="name()"
      [value]="optionValue()"
      [disabled]="disabled()"
    />
  `,
})
export class RadioButtonComponent implements ControlValueAccessor {
  public readonly inputId = input<string>('');
  public readonly name = input<string>('');
  public readonly optionValue = input<string | number | boolean | null>();
  public readonly disabled = input<boolean>(false);

  public value: string | number | boolean | null = null;

  private onChange: (value: string | number | boolean | null) => void = () => {
    /* This will be overridden by registerOnChange */
  };

  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: string | number | boolean | null): void {
    this.value = value;
  }

  public registerOnChange(
    fn: (value: string | number | boolean | null) => void
  ): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(_isDisabled: boolean): void {
    // Handle disabled state if needed
  }

  public change(value: string | number | boolean | null) {
    if (this.disabled()) return;
    this.value = value;
    this.onChange(this.value);
    this.onTouched();
  }
}
