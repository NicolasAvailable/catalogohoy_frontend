import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  forwardRef,
  input,
  OnInit,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

export interface PhoneCountry {
  iso: string;
  name: string;
  dialCode: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'VE', name: 'Venezuela', dialCode: '+58' },
  { iso: 'AR', name: 'Argentina', dialCode: '+54' },
  { iso: 'BO', name: 'Bolivia', dialCode: '+591' },
  { iso: 'BR', name: 'Brasil', dialCode: '+55' },
  { iso: 'CA', name: 'Canadá', dialCode: '+1' },
  { iso: 'CL', name: 'Chile', dialCode: '+56' },
  { iso: 'CO', name: 'Colombia', dialCode: '+57' },
  { iso: 'CR', name: 'Costa Rica', dialCode: '+506' },
  { iso: 'CU', name: 'Cuba', dialCode: '+53' },
  { iso: 'DO', name: 'República Dominicana', dialCode: '+1' },
  { iso: 'EC', name: 'Ecuador', dialCode: '+593' },
  { iso: 'SV', name: 'El Salvador', dialCode: '+503' },
  { iso: 'ES', name: 'España', dialCode: '+34' },
  { iso: 'US', name: 'Estados Unidos', dialCode: '+1' },
  { iso: 'FR', name: 'Francia', dialCode: '+33' },
  { iso: 'GT', name: 'Guatemala', dialCode: '+502' },
  { iso: 'HN', name: 'Honduras', dialCode: '+504' },
  { iso: 'IT', name: 'Italia', dialCode: '+39' },
  { iso: 'MX', name: 'México', dialCode: '+52' },
  { iso: 'NI', name: 'Nicaragua', dialCode: '+505' },
  { iso: 'PA', name: 'Panamá', dialCode: '+507' },
  { iso: 'PY', name: 'Paraguay', dialCode: '+595' },
  { iso: 'PE', name: 'Perú', dialCode: '+51' },
  { iso: 'PT', name: 'Portugal', dialCode: '+351' },
  { iso: 'PR', name: 'Puerto Rico', dialCode: '+1' },
  { iso: 'GB', name: 'Reino Unido', dialCode: '+44' },
  { iso: 'UY', name: 'Uruguay', dialCode: '+598' },
];

const COUNTRIES_BY_DIAL_LENGTH = [...PHONE_COUNTRIES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length
);

const NATIONAL_PLACEHOLDER_BY_ISO: Record<string, string> = {
  VE: '412 1234567',
  AR: '11 12345678',
  BR: '11 91234 5678',
  CL: '9 1234 5678',
  CO: '301 1234567',
  EC: '99 123 4567',
  ES: '612 345 678',
  MX: '55 1234 5678',
  PE: '912 345 678',
  US: '201 555 0123',
};

@Component({
  selector: 'ui-input-phone',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, InputTextModule],
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputPhoneComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui-phone" [class.ui-phone--disabled]="disabled()">
      <p-select
        [options]="countries"
        [ngModel]="selectedCountry()"
        (ngModelChange)="onCountryChange($event)"
        optionLabel="name"
        [filter]="true"
        filterPlaceholder="Buscar país..."
        scrollHeight="15rem"
        [disabled]="disabled()"
        appendTo="body"
        styleClass="ui-phone__select"
        panelStyleClass="ui-phone__panel"
      >
        <ng-template #selectedItem let-c>
          @if (c) {
          <span class="ui-phone__selected">
            <img
              [src]="flagUrl(c.iso)"
              [alt]="c.name"
              class="ui-phone__flag"
              loading="lazy"
              width="20"
              height="15"
            />
            <span class="ui-phone__dial">{{ c.dialCode }}</span>
          </span>
          }
        </ng-template>
        <ng-template #item let-c>
          <span class="ui-phone__option">
            <img
              [src]="flagUrl(c.iso)"
              [alt]="c.name"
              class="ui-phone__flag"
              loading="lazy"
              width="20"
              height="15"
            />
            <span class="ui-phone__option-name">{{ c.name }}</span>
            <span class="ui-phone__option-dial">{{ c.dialCode }}</span>
          </span>
        </ng-template>
      </p-select>

      <input
        pInputText
        type="tel"
        inputmode="tel"
        [ngModel]="nationalNumber()"
        (ngModelChange)="onNationalChange($event)"
        [placeholder]="placeholderForCountry()"
        [disabled]="disabled()"
        class="ui-phone__input"
      />
    </div>
  `,
  styles: [
    `
      .ui-phone {
        display: flex;
        align-items: stretch;
        width: 100%;
        gap: 0.5rem;
      }
      .ui-phone--disabled {
        opacity: 0.6;
        pointer-events: none;
      }
      .ui-phone .ui-phone__select .p-select {
        min-width: 7rem;
      }
      .ui-phone .ui-phone__select .p-select-label {
        display: flex !important;
        align-items: center;
      }
      .ui-phone__selected,
      .ui-phone__option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .ui-phone__option {
        width: 100%;
      }
      .ui-phone__flag {
        width: 1.25rem;
        height: 0.9375rem;
        border-radius: 0.125rem;
        object-fit: cover;
        flex-shrink: 0;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06);
      }
      .ui-phone__dial {
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
      }
      .ui-phone__option-name {
        flex: 1;
        font-size: 0.875rem;
        color: #1f2937;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ui-phone__option-dial {
        font-size: 0.75rem;
        color: #6b7280;
      }
      .ui-phone .ui-phone__input.p-inputtext {
        flex: 1;
      }
    `,
  ],
})
export class InputPhoneComponent implements ControlValueAccessor, OnInit {
  public readonly defaultCountry = input<string>('ve');
  public readonly disabled = signal(false);
  public readonly countries = PHONE_COUNTRIES;
  public readonly selectedCountry = signal<PhoneCountry>(
    PHONE_COUNTRIES.find((c) => c.iso === 'VE') ?? PHONE_COUNTRIES[0]
  );
  public readonly nationalNumber = signal('');

  public readonly placeholderForCountry = computed(
    () => NATIONAL_PLACEHOLDER_BY_ISO[this.selectedCountry().iso] ?? '1234567'
  );

  private onChange: (value: string | null) => void = () => {
    /* overridden by registerOnChange */
  };
  private onTouched: () => void = () => {
    /* overridden by registerOnTouched */
  };

  ngOnInit(): void {
    const iso = (this.defaultCountry() ?? 've').toUpperCase();
    const found = PHONE_COUNTRIES.find((c) => c.iso === iso);
    if (found) this.selectedCountry.set(found);
  }

  writeValue(value: string | null): void {
    if (!value || !value.trim()) {
      this.nationalNumber.set('');
      return;
    }
    const parsed = this.parse(value);
    if (parsed.country) {
      this.selectedCountry.set(parsed.country);
    }
    this.nationalNumber.set(parsed.national);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onCountryChange(country: PhoneCountry | null): void {
    if (!country) return;
    this.selectedCountry.set(country);
    this.emit();
  }

  onNationalChange(value: string): void {
    this.nationalNumber.set(value ?? '');
    this.emit();
  }

  public flagUrl(iso: string): string {
    return `https://flagcdn.com/24x18/${iso.toLowerCase()}.png`;
  }

  private emit(): void {
    const country = this.selectedCountry();
    let digits = (this.nationalNumber() || '').replace(/[^0-9]/g, '');
    if (country.iso === 'VE' && digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    if (!digits) {
      this.onChange('');
      this.onTouched();
      return;
    }
    this.onChange(country.dialCode + digits);
    this.onTouched();
  }

  private parse(e164: string): {
    country: PhoneCountry | null;
    national: string;
  } {
    const clean = e164.trim();
    if (!clean.startsWith('+')) {
      return { country: null, national: clean.replace(/[^0-9]/g, '') };
    }
    const digits = clean.substring(1).replace(/[^0-9]/g, '');
    for (const c of COUNTRIES_BY_DIAL_LENGTH) {
      const code = c.dialCode.substring(1);
      if (digits.startsWith(code)) {
        return { country: c, national: digits.substring(code.length) };
      }
    }
    return { country: null, national: digits };
  }
}
