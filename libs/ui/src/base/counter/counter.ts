import { Component, effect, forwardRef, input, linkedSignal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ButtonComponent } from '../button';

@Component({
  selector: 'ui-counter',
  imports: [FormsModule, ButtonComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CounterComponent),
      multi: true,
    },
  ],
  template: ` <ui-button
    (click)="change()"
    [label]="count().toString()"
    [icon]="icon()"
    [size]="size()"
    [styleClass]="'text-grey-300! bg-grey-50! border-none! gap-1.5! w-20! ' + styleClass()"
  />`,
})
export class CounterComponent implements ControlValueAccessor {
  public readonly count = input.required<number>();
  public readonly size = input<'small' | 'large' | undefined>('large');
  public readonly icon = input.required<string>();
  public readonly styleClass = input('');

  public readonly value = linkedSignal(() => this.count());

  constructor() {
    effect(() => this.change());
  }

  private onChange: (value: number) => void = () => {
    /* This will be overridden by registerOnChange */
  };

  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: number): void {
    this.value.set(value);
  }

  public registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public change() {
    this.value.set(this.value());
    this.onChange(this.value());
    this.onTouched();
  }
}
