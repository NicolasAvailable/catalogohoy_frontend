import { CommonModule } from '@angular/common';
import {
  Component,
  forwardRef,
  Injector,
  input,
  OnInit,
  signal,
} from '@angular/core';
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
      [showButtons]="showButtons()"
      [inputId]="inputId()"
      [fluid]="true"
      [min]="min()"
      [max]="max()"
      [size]="size()"
      [step]="step()"
      [disabled]="disabled()"
      [mode]="mode()"
      [currency]="currency()"
      [locale]="locale()"
      [prefix]="prefix()"
      [placeholder]="placeholder()"
      [minFractionDigits]="minFractionDigits()"
      [maxFractionDigits]="maxFractionDigits()"
      buttonLayout="horizontal"
      [inputStyleClass]="showButtons() ? 'text-center' : ''"
      [styleClass]="styleClass()"
    >
      @if (showButtons()) {
      <ng-template #incrementbuttonicon>
        <ui-icon name="plus" styleClass="size-5!" />
      </ng-template>
      <ng-template #decrementbuttonicon>
        <ui-icon name="minus" styleClass="size-5!" />
      </ng-template>
      }
    </p-inputnumber>
  `,
})
export class InputNumberComponent implements OnInit {
  public readonly min = input<number | undefined>(undefined);
  public readonly max = input<number | undefined>(undefined);
  public readonly step = input<number>(1);
  public readonly inputId = input('');
  public readonly size = input<'small' | 'large' | undefined>(undefined);
  public readonly placeholder = input('');
  public readonly styleClass = input('');
  public readonly showButtons = input<boolean>(true);
  public readonly mode = input<'decimal' | 'currency'>('decimal');
  public readonly currency = input<string | undefined>(undefined);
  public readonly locale = input<string | undefined>(undefined);
  public readonly prefix = input<string | undefined>(undefined);
  public readonly minFractionDigits = input<number | undefined>(undefined);
  public readonly maxFractionDigits = input<number | undefined>(undefined);

  public readonly value = signal<number | null>(null);
  public readonly disabled = signal(false);

  public control: NgControl | null = null;

  private onChange: (value: number) => void = () => {
    /* Implementation provided by Reactive Forms */
  };
  private onTouched: () => void = () => {
    /* Implementation provided by Reactive Forms */
  };

  constructor(private readonly injector: Injector) {}

  ngOnInit(): void {
    this.control = this.injector.get(NgControl, null) as NgControl;
    this.control.valueAccessor = this;
  }

  public writeValue(value: number): void {
    this.value.set(value);
  }

  public registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  public change(value: number) {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }
}
