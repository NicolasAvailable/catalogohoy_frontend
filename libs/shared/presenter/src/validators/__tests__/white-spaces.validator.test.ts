import { FormControl, ValidatorFn } from '@angular/forms';
import { whiteSpacesValidator } from '../white-spaces.validator';

describe('whiteSpacesValidator', () => {
  let validator: ValidatorFn;
  let control: FormControl;

  beforeEach(() => {
    validator = whiteSpacesValidator();
    control = new FormControl('', { validators: [validator] });
  });

  it('should validate non-empty strings', () => {
    control.setValue('test');
    expect(validator(control)).toBeNull();
  });

  it('should validate strings with spaces between words', () => {
    control.setValue('test string');
    expect(validator(control)).toBeNull();
  });

  it('should reject empty string', () => {
    control.setValue('');
    expect(validator(control)).toEqual({ whitespace: true });
  });

  it('should reject whitespace-only strings', () => {
    control.setValue('   ');
    expect(validator(control)).toEqual({ whitespace: true });
  });

  it('should validate strings with leading/trailing spaces', () => {
    control.setValue('  test  ');
    expect(validator(control)).toBeNull();
  });
});
