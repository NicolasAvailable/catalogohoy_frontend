import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BaseComponent, whiteSpacesValidator } from '@shared/presenter';
import {
  ButtonComponent,
  IconComponent,
  InputPasswordComponent,
  InputTextComponent,
} from '@ui';
import { AuthenticationFacade } from '../../../application';
import { SignUpCredentials } from '../../../domain';
@Component({
  selector: 'app-signup',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextComponent,
    InputPasswordComponent,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './signup.html',
})
export class Signup extends BaseComponent {
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
    password: [
      '',
      [Validators.required, Validators.minLength(6), whiteSpacesValidator()],
    ],
  });

  public async send() {
    if (this.form.valid && this.loaderStore.isDisable()) {
      const result = await this.authenticationFacade.signup(
        this.form.value as SignUpCredentials
      );
      result.mapRight((url) => (window.location.href = url));
    }
  }
}
