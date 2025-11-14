import { CommonModule } from '@angular/common';
import { Component, contentChild, forwardRef, input, output, signal, TemplateRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { is } from '@shared/domain';
import { Segment, SegmentComponent } from '../segment/segment';

@Component({
  selector: 'ui-segment-list',
  imports: [CommonModule, FormsModule, SegmentComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SegmentListComponent),
      multi: true,
    },
  ],
  template: `
    <div [class]="'flex flex-col gap-3 ' + styleClass()">
      @for(segment of segments(); track $index) {
      <ui-segment
        (ngModelChange)="select(segment, $index, $event)"
        [ngModel]="isSelected($index)"
        [segment]="segment"
        [styleClass]="itemStyleClass()"
      >
        <ng-template #item>
          <ng-container [ngTemplateOutlet]="itemTemplate()" [ngTemplateOutletContext]="{ $implicit: segment }" />
        </ng-template>
      </ui-segment>
      }
    </div>
  `,
})
export class SegmentListComponent<T> implements ControlValueAccessor {
  public readonly segments = input.required<Segment[]>();
  public readonly styleClass = input<string>('');
  public readonly itemStyleClass = input<string>('');

  public readonly valueChange = output<T | undefined>();

  public readonly value = signal<T | undefined>(undefined);
  public readonly disabled = signal(false);
  public readonly selectedIndex = signal<number | null>(null);

  public readonly itemTemplate = contentChild<TemplateRef<{ $implicit: Segment }>>('item');

  private onChange: (value: T | undefined) => void = () => {
    /* This will be overridden by registerOnChange */
  };

  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: T | undefined): void {
    this.value.set(value);
    const index = this.segments().findIndex((segment) => segment.value === value);
    this.selectedIndex.set(index >= 0 ? index : null);
  }

  public registerOnChange(fn: (value: T | undefined) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public isSelected(index: number): boolean {
    return this.selectedIndex() === index;
  }

  public setDisabled(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  public select(segment: Segment, index: number, isSelected: boolean): void {
    if (this.disabled()) return;

    const result = is.affirmative(isSelected);
    result.mapRight(() => this.update(segment.value as T, index));
    result.mapLeft(() => this.update(undefined));
    this.onTouched();
  }

  private update(value: T | undefined, index: number | null = null): void {
    this.value.set(value);
    this.valueChange.emit(value);
    this.selectedIndex.set(index);
    this.onChange(value);
  }
}
