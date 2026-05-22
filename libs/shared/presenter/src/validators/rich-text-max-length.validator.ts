import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function richTextMaxLengthValidator(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const html: string = control.value ?? '';
    if (!html) return null;
    const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    return text.length > max
      ? { richTextMaxLength: { max, actual: text.length } }
      : null;
  };
}
