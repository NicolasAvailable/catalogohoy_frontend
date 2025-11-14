import { FormBuilder, FormGroup } from '@angular/forms';
import { confirmPasswordValidator } from '../confirm-password.validator';

describe('confirmPasswordValidator', () => {
  let formGroup: FormGroup;
  const formBuilder = new FormBuilder();

  const createFormGroup = (password: string, confirmPassword: string): FormGroup => {
    return formBuilder.group(
      {
        password: [password],
        passwordConfirmed: [confirmPassword],
      },
      { validators: [confirmPasswordValidator] }
    );
  };

  it('should return null when passwords match', () => {
    const password = 'Test@123';
    formGroup = createFormGroup(password, password);

    const result = confirmPasswordValidator(formGroup);

    expect(result).toBeNull();
    expect(formGroup.valid).toBeTruthy();
  });

  it('should return validation error when passwords do not match', () => {
    formGroup = createFormGroup('Test@123', 'Different@123');

    const result = confirmPasswordValidator(formGroup);

    expect(result).toEqual({ confirmPassword: true });
    expect(formGroup.valid).toBeFalsy();
  });

  it('should return null when both password fields are empty', () => {
    formGroup = createFormGroup('', '');

    const result = confirmPasswordValidator(formGroup);

    expect(result).toBeNull();
    expect(formGroup.valid).toBeTruthy();
  });

  it('should return validation error when one password field is empty and the other is not', () => {
    formGroup = createFormGroup('Test@123', '');
    expect(confirmPasswordValidator(formGroup)).toEqual({ confirmPassword: true });
    expect(formGroup.valid).toBeFalsy();

    formGroup = createFormGroup('', 'Test@123');
    expect(confirmPasswordValidator(formGroup)).toEqual({ confirmPassword: true });
    expect(formGroup.valid).toBeFalsy();
  });

  it('should be case sensitive when comparing passwords', () => {
    formGroup = createFormGroup('Test@123', 'test@123');

    const result = confirmPasswordValidator(formGroup);

    expect(result).toEqual({ confirmPassword: true });
    expect(formGroup.valid).toBeFalsy();
  });
});
