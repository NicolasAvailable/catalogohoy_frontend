import { CommonModule } from '@angular/common';
import * as _ from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { SelectModule } from 'primeng/select';

@_.Directive({ selector: '[selectSelectedItem]', standalone: true })
export class SelectSelectedItemDirective {}

@_.Directive({ selector: '[selectItem]', standalone: true })
export class SelectItemDirective {}

@_.Component({
  selector: 'ui-select',
  imports: [CommonModule, FormsModule, SelectModule, TranslocoPipe],
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
      [filterPlaceholder]="filterPlaceholder() | transloco"
      [variant]="variant()"
      [attr.mode]="mode()"
      [virtualScroll]="virtualScroll()"
      [virtualScrollItemSize]="38"
      [scrollHeight]="height()"
      [size]="size()"
      [fluid]="true"
      [showClear]="clearable()"
      [styleClass]="styleClass()"
      [appendTo]="appendTo()"
      [id]="selectId()"
      [panelStyleClass]="panelStyleClass()"
      [emptyMessage]="emptyMessage() | transloco"
      [emptyFilterMessage]="emptyFilterMessage() | transloco"
    >
      <ng-template #selectedItem let-selected>
        @if(selectedItemTemplate()) {
          <ng-container [ngTemplateOutlet]="selectedItemTemplate()!" [ngTemplateOutletContext]="{ $implicit: selected }"></ng-container>
        } @else {
          {{ getOptionLabel(selected) }}
        }
      </ng-template>

      <ng-template #item let-item>
        @if(itemTemplate()) {
          <ng-container [ngTemplateOutlet]="itemTemplate()!" [ngTemplateOutletContext]="{ $implicit: item }"></ng-container>
        } @else {
          {{ getOptionLabel(item) }}
        }
      </ng-template>

      @if(footerTemplate) {
        <ng-template pTemplate="footer">
          <ng-container [ngTemplateOutlet]="footerTemplate"></ng-container>
        </ng-template>
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
  public readonly size = _.input<'small' | 'large' | undefined>(undefined);
  public readonly styleClass = _.input('');
  public readonly panelStyleClass = _.input('');
  public readonly appendTo = _.input('body');
  public readonly selectId = _.input('');
  public readonly emptyMessage = _.input('Sin resultados');
  public readonly emptyFilterMessage = _.input('Sin resultados');
  public readonly filterPlaceholder = _.input('Buscar...');
  // Off by default — PrimeNG virtual scroll mis-measures when options come
  // from signals or templates contain async content (images), causing
  // blank-until-scroll glitches. Opt in only for truly large (>200 item) lists.
  public readonly virtualScroll = _.input(false);

  @_.ContentChild(SelectSelectedItemDirective, { read: _.TemplateRef })
  private _selectedItemTemplate?: _.TemplateRef<unknown>;
  @_.ContentChild(SelectItemDirective, { read: _.TemplateRef })
  private _itemTemplate?: _.TemplateRef<unknown>;
  @_.ContentChild('footer', { read: _.TemplateRef })
  footerTemplate?: _.TemplateRef<unknown>;

  // Signals para los templates que se actualizan después de AfterContentInit
  public readonly selectedItemTemplate =
    _.signal<_.TemplateRef<unknown> | null>(null);
  public readonly itemTemplate = _.signal<_.TemplateRef<unknown> | null>(null);

  public readonly value = _.signal<T | null>(null);
  public readonly disabled = _.signal(false);

  ngAfterContentInit() {
    // Actualizar signals después de que los ContentChild sean detectados
    if (this._selectedItemTemplate) {
      this.selectedItemTemplate.set(this._selectedItemTemplate);
    }
    if (this._itemTemplate) {
      this.itemTemplate.set(this._itemTemplate);
    }
  }

  public getOptionLabel(item: T): string {
    if (!item) return '';
    const label = this.optionLabel();
    if (label && typeof item === 'object' && item !== null) {
      return ((item as Record<string, unknown>)[label] as string) ?? '';
    }
    return String(item);
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
