import { E } from '@shared/domain';
import {
  ForgottenPasswordCredentials,
  GoogleSignupCredentials,
  LoginCredentials,
  ResetPasswordCredentials,
  SignUpCredentials,
} from './authentication.types';

export interface BaseAuthenticationService {
  login(credentials: LoginCredentials): Promise<E.Either<Error, string>>;
  signup(credentials: SignUpCredentials): Promise<E.Either<Error, string>>;
  loginWithGoogle(redirectTo: string): Promise<string | null>;
  onAuthStateChange(callback: (event: string) => void): () => void;
  getSession(): Promise<boolean>;
  getLoginRedirectUrl(): Promise<E.Either<Error, string>>;
  completeGoogleSignup(
    credentials: GoogleSignupCredentials
  ): Promise<E.Either<Error, string>>;
  forgottenPassword(
    input: ForgottenPasswordCredentials
  ): Promise<E.Either<Error, void>>;
  resetPassword(
    input: ResetPasswordCredentials
  ): Promise<E.Either<Error, void>>;
  checkEmailExists(email: string): Promise<boolean>;
  checkUserHasStore(): Promise<boolean>;
  logout(): Promise<E.Either<Error, void>>;
}
