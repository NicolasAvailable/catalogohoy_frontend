import { CommonModule } from '@angular/common';
import * as _ from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { TranslatePipe } from '@shared/presenter';
import { MultiSelectModule } from 'primeng/multiselect';

@_.Component({
  selector: 'ui-multi-select',
  imports: [CommonModule, FormsModule, TranslatePipe, MultiSelectModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: _.forwardRef(() => MultiSelectComponent),
      multi: true,
    },
  ],
  template: `
    <p-multiSelect
      (ngModelChange)="change($event)"
      [ngModel]="value()"
      [options]="options()"
      [placeholder]="placeholder()"
      [optionLabel]="optionLabel()"
      [optionValue]="optionValue()"
      [disabled]="disabled()"
      [display]="display()"
      [showClear]="showClear()"
      [styleClass]="styleClass()"
      [panelStyleClass]="panelStyleClass()"
      [appendTo]="appendTo()"
      [fluid]="true"
      [filter]="true"
      [inputId]="inputId()"
      [emptyMessage]="emptyMessage()"
      [emptyFilterMessage]="emptyFilterMessage()"
      [filterPlaceHolder]="filterPlaceHolder()"
    >
        @if(itemTemplate) {
            <ng-template pTemplate="item" let-item>
                <ng-container [ngTemplateOutlet]="itemTemplate" [ngTemplateOutletContext]="{ $implicit: item }"></ng-container>
            </ng-template>
        } @else {
            <ng-template pTemplate="item" let-item>
                {{ optionLabel() ? item[optionLabel()!] : (item.label ?? (item | translate)) }}
            </ng-template>
        }
        @if(selectedItemsTemplate) {
            <ng-template pTemplate="selectedItems" let-value>
                <ng-container [ngTemplateOutlet]="selectedItemsTemplate" [ngTemplateOutletContext]="{ $implicit: value }"></ng-container>
            </ng-template>
        }
        @if(footerTemplate) {
            <ng-template pTemplate="footer">
                <ng-container [ngTemplateOutlet]="footerTemplate"></ng-container>
            </ng-template>
        }
    </p-multiSelect>
  `,
})
export class MultiSelectComponent<T> implements ControlValueAccessor {
  public readonly options = _.input<T[]>([]);
  public readonly placeholder = _.input('');
  public readonly optionLabel = _.input<string | undefined>(undefined);
  public readonly optionValue = _.input<string | undefined>(undefined);
  public readonly display = _.input<'chip' | 'comma'>('comma');
  public readonly showClear = _.input(false);
  public readonly styleClass = _.input('');
  public readonly panelStyleClass = _.input('');
  public readonly appendTo = _.input('body');
  public readonly inputId = _.input('');
  public readonly emptyMessage = _.input('No se encontraron resultados');
  public readonly emptyFilterMessage = _.input('No se encontraron resultados');
  public readonly filterPlaceHolder = _.input('');

  @_.ContentChild('item', { read: _.TemplateRef })
  itemTemplate?: _.TemplateRef<unknown>;
  @_.ContentChild('selectedItems', { read: _.TemplateRef })
  selectedItemsTemplate?: _.TemplateRef<unknown>;
  @_.ContentChild('footer', { read: _.TemplateRef })
  footerTemplate?: _.TemplateRef<unknown>;

  public readonly value = _.signal<T[] | null>(null);
  public readonly disabled = _.signal(false);

  private onChange: (value: T[] | null) => void = () => {
    // Empty
  };
  private onTouched: () => void = () => {
    // Empty
  };

  public writeValue(value: T[] | null): void {
    this.value.set(value);
  }

  public registerOnChange(fn: (value: T[] | null) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  public change(value: T[] | null) {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }
}
