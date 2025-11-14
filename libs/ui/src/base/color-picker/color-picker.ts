import { CommonModule } from '@angular/common';
import * as _ from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ColorFormatter } from '@shared/domain';
import { MenuComponent } from '../menu';
import { ButtonPanelDirective, ButtonSelectComponent } from '../button';
import { HexToRgbPipe, HexToHslPipe } from './pipes';

type PickerTemplate = _.TemplateRef<{ $implicit: string; pick: VoidFunction }>;

@_.Component({
  selector: 'ui-color-picker',
  imports: [
    CommonModule,
    FormsModule,
    ColorPickerModule,
    MenuComponent,
    ButtonSelectComponent,
    ButtonPanelDirective,
    HexToRgbPipe,
    HexToHslPipe,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: _.forwardRef(() => ColorPickerComponent),
      multi: true,
    },
  ],
  template: `
    <ng-container *ngTemplateOutlet="pickerTemplate(); context: { $implicit: color(), pick }"></ng-container>

    <ui-menu #menu (open)="change(color())" [items]="[{}]" [autoClose]="false" styleClass="menu--custom rounded-2xl!">
      <ng-template #item>
        <section class="flex flex-col px-3 py-2">
          <p-colorpicker
            #colorPicker
            [(ngModel)]="color"
            (ngModelChange)="change($event)"
            [format]="'hex'"
            [inline]="true"
          />

          <footer class="mt-1">
            <ui-button-select [(ngModel)]="selectedFormat" [items]="formats()" [showPanels]="true" size="small" labelStyleClass="text-sm uppercase">
              <ng-template buttonPanel="hex">
                <div class="h-9 flex items-center bg-grey-50 rounded-base px-3">
                  <input [(ngModel)]="color" class="outline-none" />
                </div>
              </ng-template>

              <ng-template buttonPanel="rgb">
                 <div class="h-9 flex items-center bg-grey-50 rounded-base px-3">
                  <input 
                    #rgbInput
                    (input)="rgbToHex(rgbInput.value)"
                    [value]="color() | hexToRgb"
                    class="outline-none bg-transparent w-full text-sm"
                  />
                </div> 
              </ng-template>

              <ng-template buttonPanel="hsl">
                 <div class="h-9 flex items-center bg-grey-50 rounded-base px-3">
                  <input 
                    #hslInput
                    (input)="hslToHex(hslInput.value)"
                    [value]="color() | hexToHsl"
                    class="outline-none bg-transparent w-full text-sm"
                  />
                </div> 
              </ng-template>
            </ui-button-select>
          </footer>
        </section>
      </ng-template>
    </ui-menu>
  `,
})
export class ColorPickerComponent implements ControlValueAccessor {
  public readonly color = _.model('#ffffff');

  public readonly valueChange = _.output<string>();

  public readonly picker = _.viewChild.required<MenuComponent>('menu');
  public readonly pickerTemplate = _.contentChild.required<PickerTemplate>('picker');

  public readonly formats = _.signal([{ label: 'hex' }, { label: 'rgb' }, { label: 'hsl' }]);
  public readonly selectedFormat = _.signal<string>('hex');

  public pick = ($event: Event): void => {
    this.picker().toggle($event);
  };

  private onChange: (value: string) => void = () => {
    /* This will be overridden by registerOnChange */
  };

  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: string): void {
    this.color.set(ColorFormatter.safeHexString(value));
  }

  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public rgbToHex(rgb: string): void {
    this.change(ColorFormatter.rgbStringToHex(rgb));
  }

  public hslToHex(hsl: string): void {
    this.change(ColorFormatter.hslStringToHex(hsl));
  }

  public change(value: string) {
    this.color.set(value);
    this.valueChange.emit(value);
    this.onChange(value);
    this.onTouched();
  }
}
