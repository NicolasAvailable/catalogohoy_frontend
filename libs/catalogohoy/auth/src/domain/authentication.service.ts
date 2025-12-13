import { E } from '@shared/domain';
import {
  ForgottenPasswordCredentials,
  LoginCredentials,
  ResetPasswordCredentials,
  SignUpCredentials,
} from './authentication.types';
import { TenantModel } from './tenant.model';

export interface BaseAuthenticationService {
  login(credentials: LoginCredentials): Promise<E.Either<Error, TenantModel>>;
  signup(credentials: SignUpCredentials): Promise<E.Either<Error, TenantModel>>;
  forgottenPassword(
    input: ForgottenPasswordCredentials
  ): Promise<E.Either<Error, void>>;
  resetPassword(
    input: ResetPasswordCredentials
  ): Promise<E.Either<Error, void>>;
}
