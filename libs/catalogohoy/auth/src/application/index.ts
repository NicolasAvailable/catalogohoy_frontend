import { inject, Injectable } from '@angular/core';
import { LoginCredentials, SignUpCredentials } from '../domain';
import { AuthenticationService } from '../infrastructure';
import { LoginUseCase } from './login.usecase';
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
}
