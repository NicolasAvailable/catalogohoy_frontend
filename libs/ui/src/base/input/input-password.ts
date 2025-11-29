import {
  Component,
  forwardRef,
  Injector,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR, NgControl } from '@angular/forms';
import { TranslatePipe } from '@shared/presenter';
import { DividerModule } from 'primeng/divider';
import { PasswordModule } from 'primeng/password';

// Password must contain at least 8 characters, including uppercase, lowercase, numbers, and special characters
export const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{8,}$/;

@Component({
  selector: 'ui-input-password',
  imports: [FormsModule, TranslatePipe, PasswordModule, DividerModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputPasswordComponent),
      multi: true,
    },
  ],
  template: `
    <p-password
      (ngModelChange)="change($event)"
      [ngModel]="value()"
      [inputId]="inputId()"
      [disabled]="disabled()"
      [placeholder]="placeholder()"
      [feedback]="feedback()"
      [size]="size()"
      [fluid]="true"
      [toggleMask]="true"
      [strongRegex]="strongRegex()"
      [promptLabel]="'UI.INPUT.PASSWORD.PROMPT_LABEL' | translate"
      [weakLabel]="'UI.INPUT.PASSWORD.WEAK_LABEL' | translate"
      [mediumLabel]="'UI.INPUT.PASSWORD.MEDIUM_LABEL' | translate"
      [strongLabel]="'UI.INPUT.PASSWORD.STRONG_LABEL' | translate"
      [fluid]="true"
      [styleClass]="styleClass()"
      [inputStyleClass]="
        control?.invalid && (control?.dirty || control?.touched)
          ? 'ng-invalid ng-dirty'
          : ''
      "
      appendTo="body"
    />
  `,
})
export class InputPasswordComponent implements OnInit {
  public readonly inputId = input('');
  public readonly size = input<'small' | 'large' | any>(undefined);
  public readonly placeholder = input('');
  public readonly feedback = input(true);
  public readonly styleClass = input('');
  public readonly strongRegex = input(passwordPattern as unknown as string);

  public readonly value = signal<string | null>(null);
  public readonly disabled = signal(false);

  public control: NgControl | null = null;

  constructor(private readonly injector: Injector) {}

  ngOnInit(): void {
    this.control = this.injector.get(NgControl, null) as NgControl;
    this.control.valueAccessor = this;
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
}
