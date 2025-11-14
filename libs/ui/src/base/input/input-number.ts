import { CommonModule } from '@angular/common';
import { Component, forwardRef, Injector, input, OnInit, signal } from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR, NgControl } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { IconComponent } from '../icon';

@Component({
  selector: 'ui-input-number',
  imports: [CommonModule, FormsModule, InputNumberModule, IconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputNumberComponent),
      multi: true,
    },
  ],
  template: `
    <p-inputnumber
      [(ngModel)]="value"
      (ngModelChange)="change($event)"
      [showButtons]="true"
      [fluid]="true"
      [min]="min()"
      [max]="max()"
      [size]="size()"
      [step]="step()"
      [disabled]="disabled()"
      buttonLayout="horizontal"
      [inputStyleClass]="'text-center'"
      [styleClass]="styleClass()"
    >
      <ng-template #incrementbuttonicon>
        <ui-icon name="plus" styleClass="size-5!" />
      </ng-template>
      <ng-template #decrementbuttonicon>
        <ui-icon name="minus" styleClass="size-5!" />
      </ng-template>
    </p-inputnumber>
  `,
})
export class InputNumberComponent implements OnInit {
  public readonly min = input<number | undefined>(undefined);
  public readonly max = input<number | undefined>(undefined);
  public readonly step = input<number>(1);
  public readonly inputId = input('');
  public readonly size = input<'small' | 'large' | any>(undefined);
  public readonly placeholder = input('');
  public readonly styleClass = input('');

  public readonly value = signal<string>('');
  public readonly disabled = signal(false);

  public control: NgControl | null = null;

  constructor(private readonly injector: Injector) {}

  ngOnInit(): void {
    this.control = this.injector.get(NgControl, null) as NgControl;
    this.control.valueAccessor = this;
  }

  private onChange: (value: string) => void = () => {
    /* This will be overridden by registerOnChange */
  };
  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: string): void {
    this.value.set(value);
  }

  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabled(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  public change(value: string) {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }
}
