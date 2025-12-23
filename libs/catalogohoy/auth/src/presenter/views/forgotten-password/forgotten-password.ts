import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BaseComponent, whiteSpacesValidator } from '@shared/presenter';
import {
  ButtonComponent,
  InputMessageComponent,
  InputTextComponent,
} from '@ui';
import { AuthenticationFacade } from '../../../application';
import { ForgottenPasswordCredentials } from '../../../domain';

@Component({
  selector: 'app-forgotten-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextComponent,
    InputMessageComponent,
    ButtonComponent,
  ],
  templateUrl: './forgotten-password.html',
})
export class ForgottenPassword extends BaseComponent {
  private readonly authenticationFacade = inject(AuthenticationFacade);
  public readonly form = inject(FormBuilder).group({
    email: [
      '',
      [Validators.required, Validators.email, whiteSpacesValidator()],
    ],
  });

  public send() {
    if (this.form.valid && this.loaderStore.isDisable()) {
      this.authenticationFacade.forgottenPassword(
        this.form.value as ForgottenPasswordCredentials
      );
    }
  }
}
