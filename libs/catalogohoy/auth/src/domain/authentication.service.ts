import { E } from '@shared/domain';
import { LoginCredentials, SignUpCredentials } from './authentication.types';

export interface BaseAuthenticationService {
  login(credentials: LoginCredentials): Promise<void>;
  signup(credentials: SignUpCredentials): Promise<E.Either<Error, any>>;
}
