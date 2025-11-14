import { CommonModule } from '@angular/common';
import * as _ from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe } from '@shared/presenter';
import { SelectButtonModule } from 'primeng/selectbutton';
import { IconComponent } from '../icon';

export type ButtonSelectOption = { label: string; value?: string; icon?: string };

@_.Directive({ selector: '[buttonPanel]' })
export class ButtonPanelDirective {
  public readonly buttonPanel = _.input.required<string>();
}

@_.Component({
  selector: 'ui-button-select',
  imports: [CommonModule, FormsModule, SelectButtonModule, IconComponent, TranslatePipe],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: _.forwardRef(() => ButtonSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div class="flex flex-col gap-3">
      <p-selectbutton
        [(ngModel)]="value"
        (ngModelChange)="change($event)"
        [options]="items()"
        optionLabel="label"
        [optionValue]="optionValue()"
        [unselectable]="unselectable()"
        [size]="size()"
        [ngClass]="{ 'w-full': fluid() }"
        [styleClass]="styleClass()"
      >
        <ng-template pTemplate="item" let-option>
          @if(option.icon){
          <ui-icon [name]="option.icon" styleClass="size-5!" />
          }
          <span [class]="labelStyleClass()">{{ option.label | translate }}</span>
        </ng-template>
      </p-selectbutton>

      @if(showPanels() && value && templateMap.has(value.toString())) {
      <ng-container [ngTemplateOutlet]="templateMap.get(value.toString())"></ng-container>
      }
    </div>
  `,
})
export class ButtonSelectComponent implements ControlValueAccessor, _.AfterContentInit {
  public readonly items = _.input.required<ButtonSelectOption[]>();
  public readonly unselectable = _.input<boolean>(true);
  public readonly size = _.input<'small' | 'large' | any>(undefined);
  public readonly fluid = _.input(true);
  public readonly showPanels = _.input<boolean>(false);
  public readonly defaultValue = _.input<string | number | null>(null);
  public readonly labelStyleClass = _.input('');
  public readonly styleClass = _.input('');

  public readonly valueChange = _.output<string>();

  public readonly optionValue = _.signal<string>('value');
  public value: string | number | null = null;

  public readonly templateMap = new Map<string, _.TemplateRef<any>>();
  @_.ContentChildren(ButtonPanelDirective, { read: _.TemplateRef }) buttonTemplates!: _.QueryList<_.TemplateRef<any>>;
  @_.ContentChildren(ButtonPanelDirective) buttonPanels!: _.QueryList<ButtonPanelDirective>;

  ngOnInit() {
    this.value = this.defaultValue() || this.items()[0].value || this.items()[0].label;
    this.optionValue.set(this.items()[0].value ? 'value' : 'label');
  }

  ngAfterContentInit() {
    const templates = this.buttonTemplates.toArray();
    const panels = this.buttonPanels.toArray();

    for (let i = 0; i < templates.length; i++) {
      if (panels[i] && panels[i].buttonPanel()) {
        this.templateMap.set(panels[i].buttonPanel(), templates[i]);
      }
    }
  }

  private onChange: (value: string) => void = () => {
    /* This will be overridden by registerOnChange */
  };

  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: string): void {
    this.value = value;
  }

  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public change(value: string) {
    this.value = value;
    this.valueChange.emit(value);
    this.onChange(value);
    this.onTouched();
  }
}
