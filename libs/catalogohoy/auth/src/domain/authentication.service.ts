import { Tenant } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import {
  ForgottenPasswordCredentials,
  LoginCredentials,
  ResetPasswordCredentials,
  SignUpCredentials,
} from './authentication.types';

export interface BaseAuthenticationService {
  login(credentials: LoginCredentials): Promise<E.Either<Error, Tenant>>;
  signup(credentials: SignUpCredentials): Promise<E.Either<Error, Tenant>>;
  forgottenPassword(
    input: ForgottenPasswordCredentials
  ): Promise<E.Either<Error, void>>;
  resetPassword(
    input: ResetPasswordCredentials
  ): Promise<E.Either<Error, void>>;
}
