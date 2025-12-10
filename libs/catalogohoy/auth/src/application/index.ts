import { inject, Injectable } from '@angular/core';
import {
  ForgottenPasswordCredentials,
  LoginCredentials,
  ResetPasswordCredentials,
  SignUpCredentials,
} from '../domain';
import { AuthenticationService } from '../infrastructure';
import { ForgottenPasswordUseCase } from './forgotten-password.usecase';
import { LoginUseCase } from './login.usecase';
import { ResetPasswordUseCase } from './reset-password.usecase';
import { SignupUseCase } from './signup.usecase';

@Injectable({ providedIn: 'root' })
export class AuthenticationFacade {
  private readonly authenticationService = inject(AuthenticationService);

  public login(input: LoginCredentials) {
    return new LoginUseCase(this.authenticationService).execute(input);
  }

  public signup(input: SignUpCredentials) {
    return new SignupUseCase(this.authenticationService).execute(input);
  }

  public forgottenPassword(input: ForgottenPasswordCredentials) {
    return new ForgottenPasswordUseCase(this.authenticationService).execute(
      input
    );
  }

  public resetPassword(input: ResetPasswordCredentials) {
    return new ResetPasswordUseCase(this.authenticationService).execute(input);
  }
}
