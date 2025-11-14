import { CommonModule } from '@angular/common';
import { Component, contentChild, forwardRef, input, output, signal, TemplateRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CardComponent } from '../card';

export type Segment = {
  title?: string;
  description?: string;
  value?: string | number;
  icon?: string;
  [key: string]: any;
};

@Component({
  selector: 'ui-segment',
  imports: [CommonModule, FormsModule, CardComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SegmentComponent),
      multi: true,
    },
  ],
  template: `
    <ui-card
      (click)="toggle()"
      [fluent]="fluent()"
      class="segment cursor-pointer"
      [ngClass]="{ selected: value(), disabled: disabled() }"
      [styleClass]="
        'segment-content ' + (value() ? 'bg-secondary-50! border-transparent ' : 'border-grey-100 ') + styleClass()
      "
    >
      <ng-container [ngTemplateOutlet]="itemTemplate()!" [ngTemplateOutletContext]="{ $implicit: segment() }" />
    </ui-card>
  `,
})
export class SegmentComponent implements ControlValueAccessor {
  public readonly segment = input<Segment>();
  public readonly fluent = input<boolean>(false);
  public readonly disabled = input<boolean>(false);
  public readonly styleClass = input<string>('');

  public readonly valueChange = output<boolean>();

  public readonly value = signal(false);

  public readonly itemTemplate = contentChild<TemplateRef<{ $implicit: Segment }>>('item');

  private onChange: (value: boolean) => void = () => {
    /* This will be overridden by registerOnChange */
  };

  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: boolean): void {
    this.value.set(value);
  }

  public registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public toggle() {
    if (this.disabled()) return;
    this.value.update((value) => !value);
    this.valueChange.emit(this.value());
    this.onChange(this.value());
    this.onTouched();
  }
}
