import { CommonModule } from '@angular/common';
import {
  Component,
  forwardRef,
  Injector,
  input,
  OnInit,
  signal,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
  NgControl,
} from '@angular/forms';
import { TranslatePipe } from '@shared/presenter';
import { InputMaskModule } from 'primeng/inputmask';

@Component({
  selector: 'ui-input-mask',
  imports: [CommonModule, InputMaskModule, TranslatePipe, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputMaskComponent),
      multi: true,
    },
  ],
  template: `
    <p-inputMask
      (ngModelChange)="change($event)"
      [ngModel]="value()"
      [id]="inputId()"
      [inputId]="inputId()"
      [placeholder]="placeholder() | translate"
      [disabled]="disabled()"
      [size]="size()"
      [fluid]="true"
      [mask]="mask()"
      [slotChar]="slotChar()"
      [autoClear]="autoClear()"
      [unmask]="unmask()"
      [characterPattern]="characterPattern()"
      [class]="styleClass()"
      [ngClass]="{
        'ng-invalid ng-dirty':
          control?.invalid && (control?.dirty || control?.touched)
      }"
    />
  `,
})
export class InputMaskComponent implements OnInit, ControlValueAccessor {
  public readonly inputId = input('');
  public readonly size = input<'small' | 'large' | undefined>(undefined);
  public readonly placeholder = input('');
  public readonly styleClass = input('');
  public readonly mask = input<string>('');
  public readonly slotChar = input<string>('_');
  public readonly autoClear = input<boolean>(true);
  public readonly unmask = input<boolean>(false);
  public readonly characterPattern = input<string>('[A-Za-z]');

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
    this.value.set(value || '');
  }

  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  public change(value: string) {
    this.value.set(value || '');
    this.onChange(value || '');
    this.onTouched();
  }

  public clear() {
    this.value.set('');
    this.onChange('');
    this.onTouched();
  }
}
