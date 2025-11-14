import { Component, forwardRef, input, OnInit, output, signal, viewChild } from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { InputOtpModule, InputOtp } from 'primeng/inputotp';

@Component({
  selector: 'ui-input-otp',
  imports: [FormsModule, InputOtpModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputOtpComponent),
      multi: true,
    },
  ],
  template: `
    <p-inputOtp
      #otp
      (ngModelChange)="change($event)"
      [ngModel]="value()"
      (paste)="valueChange.emit()"
      [integerOnly]="true"
      [length]="length()"
      [disabled]="disabled()"
      [styleClass]="styleClass()"
    />
  `,
})
export class InputOtpComponent implements OnInit {
  public readonly length = input(6);
  public readonly styleClass = input('');

  public readonly value = signal<string | null>(null);
  public readonly disabled = signal(false);

  public readonly otp = viewChild.required<InputOtp>('otp');

  public readonly valueChange = output<void>();

  ngOnInit(): void {
    this.otp().onKeyDown = this.onKeyDown.bind(this);
  }

  private onChange: (value: string | null) => void = () => {
    /* This will be overridden by registerOnChange */
  };

  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: string | null): void {
    this.value.set(value);
  }

  public registerOnChange(fn: (value: string | null) => void): void {
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

  public onKeyDown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.target as HTMLInputElement;

    switch (event.code) {
      case 'ArrowLeft':
        this.otp().moveToPrev(event);
        event.preventDefault();
        break;

      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault();
        break;

      case 'Backspace':
        if (target.value.length === 0) {
          this.otp().moveToPrev(event);
          event.preventDefault();
        }

        break;

      case 'ArrowRight':
        this.otp().moveToNext(event);
        event.preventDefault();

        break;

      default:
        if (this.otp().integerOnly && !(Number(event.key) >= 0 && Number(event.key) <= 9)) {
          event.preventDefault();
        }

        break;
    }
  }
}
