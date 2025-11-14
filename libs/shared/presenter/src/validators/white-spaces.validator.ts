import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function whiteSpacesValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    return (control.value || '').trim().length === 0 ? { whitespace: true } : null;
  };
}
