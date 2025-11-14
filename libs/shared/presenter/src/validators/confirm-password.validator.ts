import { FormGroup, ValidationErrors } from '@angular/forms';

export const confirmPasswordValidator = (formGroup: FormGroup): ValidationErrors | null => {
  const password = formGroup.get('password');
  const confirmPassword = formGroup.get('passwordConfirmed');

  return password && confirmPassword && password.value !== confirmPassword.value ? { confirmPassword: true } : null;
};
