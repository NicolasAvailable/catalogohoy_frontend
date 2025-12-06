import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { whiteSpacesValidator } from '@shared/presenter';
import {
  ButtonComponent,
  InputMaskComponent,
  InputPasswordComponent,
  InputTextComponent,
} from '@ui';
import { AuthenticationFacade } from '../../application';
import { SignUpCredentials } from '../../domain';
@Component({
  selector: 'app-signup',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextComponent,
    InputPasswordComponent,
    InputMaskComponent,
    ButtonComponent,
  ],
  templateUrl: './signup.html',
})
export class Signup {
  private readonly authenticationFacade = inject(AuthenticationFacade);
  public readonly form = inject(FormBuilder).group({
    name: [
      '',
      [Validators.required, Validators.minLength(4), whiteSpacesValidator()],
    ],
    email: [
      '',
      [Validators.required, Validators.email, whiteSpacesValidator()],
    ],
    storeName: ['', [Validators.required, Validators.minLength(3)]],
    phone: [
      '',
      [Validators.required, Validators.minLength(10), whiteSpacesValidator()],
    ],
    password: [
      '',
      [Validators.required, Validators.minLength(6), whiteSpacesValidator()],
    ],
  });

  public send() {
    if (this.form.valid) {
      this.authenticationFacade.signup(this.form.value as SignUpCredentials);
    }
  }
}
