import { inject, Injectable } from '@angular/core';
import {
  ForgottenPasswordCredentials,
  GoogleSignupCredentials,
  LoginCredentials,
  ResetPasswordCredentials,
  SignUpCredentials,
} from '../domain';
import { AuthenticationService } from '../infrastructure';
import { CompleteGoogleSignupUseCase } from './complete-google-signup.usecase';
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

  public completeGoogleSignup(input: GoogleSignupCredentials) {
    return new CompleteGoogleSignupUseCase(this.authenticationService).execute(
      input
    );
  }

  public async loginWithGoogle(
    context: 'signup' | 'login'
  ): Promise<string | null> {
    const redirectTo = `${window.location.origin}/${context}`;
    return this.authenticationService.loginWithGoogle(redirectTo);
  }

  public onAuthStateChange(callback: (event: string) => void): () => void {
    return this.authenticationService.onAuthStateChange(callback);
  }

  public getSession(): Promise<boolean> {
    return this.authenticationService.getSession();
  }

  public getLoginRedirectUrl() {
    return this.authenticationService.getLoginRedirectUrl();
  }

  public checkEmailExists(email: string) {
    return this.authenticationService.checkEmailExists(email);
  }

  public checkUserHasStore() {
    return this.authenticationService.checkUserHasStore();
  }

  public logout() {
    return this.authenticationService.logout();
  }

  public forgottenPassword(input: ForgottenPasswordCredentials) {
    return new ForgottenPasswordUseCase(this.authenticationService).execute(
      input
    );
  }

  public resetPassword(input: ResetPasswordCredentials) {
    return new ResetPasswordUseCase(this.authenticationService).execute(input);
  }

  public validateInviteToken(token: string) {
    return this.authenticationService.validateInviteToken(token);
  }

  public acceptInvite(token: string) {
    return this.authenticationService.acceptInvite(token);
  }

  public signupInvitee(credentials: { email: string; password: string; name: string }) {
    return this.authenticationService.signupInvitee(credentials);
  }
}
