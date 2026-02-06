import {
  Component,
  effect,
  forwardRef,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { $date } from '@shared/domain';
import { DatePickerModule } from 'primeng/datepicker';

@Component({
  selector: 'ui-datepicker',
  imports: [FormsModule, DatePickerModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatepickerComponent),
      multi: true,
    },
  ],
  template: `<p-datepicker
    [(ngModel)]="value"
    (ngModelChange)="change($event)"
    (onClear)="cleaned.emit()"
    [showClear]="showClear()"
    [dateFormat]="dateFormat()"
    [selectionMode]="mode()"
    [minDate]="minDate()"
    [maxDate]="maxDate()"
    [showTime]="showTime()"
    [hourFormat]="'12'"
    [iconDisplay]="'input'"
    [showIcon]="true"
    [size]="size()"
    [readonlyInput]="true"
    [keepInvalid]="true"
    [fluid]="true"
    [disabled]="disabled()"
    [appendTo]="'body'"
    [panelStyleClass]="panelStyleClass()"
    [styleClass]="styleClass()"
    [inputStyleClass]="
      'bg-white-500! text-grey-800! text-base! font-medium! cursor-pointer!'
    "
  /> `,
})
export class DatepickerComponent implements ControlValueAccessor {
  public readonly dateFormat = input('dd-mm-yy');
  public readonly mode = input<'single' | 'multiple' | 'range'>('single');
  public readonly minDate = model<Date | null>(null);
  public readonly maxDate = input<Date | null>(null);
  public readonly restrict = input(false);
  public readonly size = input<'small' | 'large' | any>(undefined);
  public readonly showClear = input(false);
  public readonly showTime = input(false);
  public readonly panelStyleClass = input('');
  public readonly styleClass = input('');

  public readonly disabled = signal(false);
  public readonly value = signal(new Date());
  public readonly cleaned = output<void>();

  constructor() {
    effect(() =>
      this.minDate.set(this.restrict() ? $date().minus.minutes(1) : null)
    );
  }

  private onChange: (value: Date) => void = () => {
    /* This will be overridden by registerOnChange */
  };

  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(
    value: Date | string | number | null | undefined | unknown
  ): void {
    this.value.set($date.create(value));
  }

  public registerOnChange(fn: (value: Date) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabled(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  public change(value: Date) {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }

  public clear() {
    this.value.set(new Date());
    this.onChange(this.value());
    this.onTouched();
  }
}
