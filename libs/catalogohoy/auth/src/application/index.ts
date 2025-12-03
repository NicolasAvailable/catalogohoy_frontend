import { inject, Injectable } from '@angular/core';
import { SignUpCredentials } from '../domain';
import { AuthenticationService } from '../infrastructure';
import { SignupUseCase } from './signup.usecase';

@Injectable({ providedIn: 'root' })
export class AuthenticationFacade {
  private readonly authenticationService = inject(AuthenticationService);

  public signup(input: SignUpCredentials) {
    new SignupUseCase(this.authenticationService).execute(input);
  }
}
