import { Component, forwardRef, input, output, signal } from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { has } from '@shared/domain';
import { ToggleSwitch } from 'primeng/toggleswitch';

@Component({
  selector: 'ui-toggle',
  imports: [FormsModule, ToggleSwitch],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ToggleComponent),
      multi: true,
    },
  ],
  template: `
    <p-toggleswitch
      (ngModelChange)="change($event)"
      [ngModel]="value()"
      [disabled]="disabled()"
      [styleClass]="styleClass()"
      [inputId]="toggleId()"
    />
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
    `,
  ],
})
export class ToggleComponent implements ControlValueAccessor {
  public readonly styleClass = input('');
  public readonly toggleId = input<string>('');
  public readonly defaultDisabled = input<boolean>(false);

  public readonly enable = output<void>();
  public readonly disable = output<void>();

  public readonly value = signal(false);
  public readonly disabled = signal(false);

  private onChange: (value: boolean) => void = () => {
    /* This will be overridden by registerOnChange */
  };

  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: boolean): void {
    this.value.set(!!value);
  }

  public registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  public change(value: boolean) {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
    has(value).mapRight(() => this.enable.emit());
    has(value).mapLeft(() => this.disable.emit());
  }

  public clear() {
    this.value.set(false);
    this.onChange(false);
    this.onTouched();
  }
}
