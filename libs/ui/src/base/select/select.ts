import { CommonModule } from '@angular/common';
import * as _ from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { TranslatePipe } from '@shared/presenter';
import { SelectModule } from 'primeng/select';

@_.Directive({ selector: '[selectSelectedItem]' })
export class SelectSelectedItemDirective {}

@_.Directive({ selector: '[selectItem]' })
export class SelectItemDirective {}

@_.Component({
  selector: 'ui-select',
  imports: [CommonModule, FormsModule, TranslatePipe, SelectModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: _.forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
  template: `
    <p-select
      (ngModelChange)="change($event)"
      [ngModel]="value()"
      [options]="options()"
      [placeholder]="placeholder()"
      [optionLabel]="optionLabel()"
      [optionValue]="optionValue()"
      [disabled]="disabled()"
      [filter]="filter()"
      [variant]="variant()"
      [attr.mode]="mode()"
      [virtualScroll]="true"
      [virtualScrollItemSize]="30"
      [scrollHeight]="height()"
      [size]="size()"
      [fluid]="true"
      [showClear]="clearable()"
      [styleClass]="styleClass()"
      [appendTo]="appendTo()"
      [id]="selectId()"
      [panelStyleClass]="panelStyleClass()"
    >
      @if(selectedItemTemplate) {
        <ng-template #selectedItem let-selected>
          <ng-container [ngTemplateOutlet]="selectedItemTemplate" [ngTemplateOutletContext]="{ $implicit: selected }"></ng-container>
        </ng-template>
      } @else {
        <ng-template #selectedItem let-selected>{{ selected.label ?? selected | translate }}</ng-template>
      }

      @if(itemTemplate) {
        <ng-template #item let-item>
          <ng-container [ngTemplateOutlet]="itemTemplate" [ngTemplateOutletContext]="{ $implicit: item }"></ng-container>
        </ng-template>
      } @else {
        <ng-template #item let-item> {{ item.label ?? item | translate }} </ng-template>
      }
    </p-select>
  `,
})
export class SelectComponent<T>
  implements ControlValueAccessor, _.AfterContentInit
{
  public readonly options = _.input<T[]>([]);
  public readonly placeholder = _.input('');
  public readonly optionLabel = _.input<string | undefined>(undefined);
  public readonly optionValue = _.input<string | undefined>(undefined);
  public readonly height = _.input<string>('12rem');
  public readonly clearable = _.input(false);
  public readonly filter = _.input(false);
  public readonly variant = _.input<'filled' | 'outlined'>('outlined');
  public readonly mode = _.input<'text' | 'normal'>('normal');
  public readonly size = _.input<'small' | 'large' | 'normal' | any>(undefined);
  public readonly styleClass = _.input('');
  public readonly panelStyleClass = _.input('');
  public readonly appendTo = _.input('body');
  public readonly selectId = _.input('');

  @_.ContentChild(SelectSelectedItemDirective, { read: _.TemplateRef })
  selectedItemTemplate?: _.TemplateRef<any>;
  @_.ContentChild(SelectItemDirective, { read: _.TemplateRef })
  itemTemplate?: _.TemplateRef<any>;

  public readonly value = _.signal<T | null>(null);
  public readonly disabled = _.signal(false);

  ngAfterContentInit() {
    // Templates are automatically detected via @ContentChild
  }

  private onChange: (value: T | null) => void = () => {
    /* This will be overridden by registerOnChange */
  };

  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: T | null): void {
    this.value.set(value);
  }

  public registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabled(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  public change(value: T | null) {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }

  public clear() {
    this.value.set(null);
    this.onChange(null);
    this.onTouched();
  }
}
