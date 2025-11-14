import { CommonModule } from '@angular/common';
import { Component, forwardRef, inject, Injector, input, signal, ViewEncapsulation } from '@angular/core';
import { FormControl, NG_VALUE_ACCESSOR, NgControl, ReactiveFormsModule } from '@angular/forms';
import { has, sleep } from '@shared/domain';
import { LocationService } from '@shared/infrastructure';
import { TranslatePipe } from '@shared/presenter';
import { ChangeData, CountryISO, NgxIntlTelInputModule } from 'ngx-intl-tel-input';
import { InputTextModule } from 'primeng/inputtext';
import { not } from 'ramda';

@Component({
  selector: 'ui-input-tel',
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe, NgxIntlTelInputModule, InputTextModule],
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputTelComponent),
      multi: true,
    },
  ],
  styles: ['.iti__country-list { max-height: 15rem !important }'],
  template: `
    <ngx-intl-tel-input
      pInputText
      [formControl]="value"
      [id]="inputId()"
      [enablePlaceholder]="true"
      [customPlaceholder]="placeholder() | translate"
      [searchCountryPlaceholder]="'GLOBAL.SEARCH_COUNTRY' | translate"
      [selectedCountryISO]="selectedCountryISO()"
      [searchCountryFlag]="true"
      [enableAutoCountrySelect]="true"
      [disabled]="disabled()"
      [pSize]="size()"
      [fluid]="true"
      [cssClass]="'outline-none ' + styleClass()"
      [ngClass]="{ 'ng-invalid ng-dirty': control?.invalid && (control?.dirty || control?.touched) }"
      class="block w-full"
    />
  `,
})
export class InputTelComponent {
  public readonly inputId = input('');
  public readonly size = input<'small' | 'large' | any>(undefined);
  public readonly placeholder = input('');
  public readonly styleClass = input('');

  public readonly disabled = signal(false);
  public readonly selectedCountryISO = signal<CountryISO>(CountryISO.Spain);

  public readonly locationService = inject(LocationService);

  public readonly value = new FormControl('');
  public control: NgControl | null = null;

  constructor(private readonly injector: Injector) {}

  ngOnInit(): void {
    this.control = this.injector.get(NgControl, null) as NgControl;
    this.control.valueAccessor = this;
    this.value.valueChanges.subscribe((value) => {
      this.change(value as unknown as ChangeData);
      this.control?.control?.markAsDirty();
      this.control?.control?.markAsTouched();
      this.control?.control?.setErrors(this.value.errors);
    });

    sleep(1000, { when: not(this.locationService.countryCode) }).then(() => {
      this.selectedCountryISO.set(this.locationService.countryCode.toLowerCase() as CountryISO);
    });
  }

  private onChange: (value: string | null) => void = () => {
    /* This will be overridden by registerOnChange */
  };
  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: string | null): void {
    has(value).mapRight(() => (value = '+' + value?.replace('+', '')));
    this.value.patchValue(value);
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

  public change(data: ChangeData) {
    let number = '';
    has(data).mapRight(() => (number = data!.dialCode! + data!.nationalNumber));
    this.onChange(number);
    this.onTouched();
  }
}
