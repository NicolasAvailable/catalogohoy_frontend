import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BaseComponent, whiteSpacesValidator } from '@shared/presenter';
import {
  ButtonComponent,
  IconComponent,
  InputMessageComponent,
  InputPasswordComponent,
  InputTextComponent,
} from '@ui';
import { AuthenticationFacade } from '../../../application';
import { LoginCredentials } from '../../../domain';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextComponent,
    InputMessageComponent,
    InputPasswordComponent,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './login.html',
})
export class Login extends BaseComponent {
  private readonly authenticationFacade = inject(AuthenticationFacade);
  public readonly form = inject(FormBuilder).group({
    email: [
      '',
      [Validators.required, Validators.email, whiteSpacesValidator()],
    ],
    password: [
      '',
      [Validators.required, Validators.minLength(6), whiteSpacesValidator()],
    ],
  });

  public async send() {
    if (this.form.valid && this.loaderStore.isDisable()) {
      const result = await this.authenticationFacade.login(
        this.form.value as LoginCredentials
      );
      result.mapRight((url) => (window.location.href = url));
    }
  }
}
