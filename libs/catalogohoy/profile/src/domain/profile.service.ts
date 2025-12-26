import { E } from '@shared/domain';
import { Profile } from './profile.model';

export interface BaseProfileService {
  profile(): Promise<E.Either<Error, Profile>>;
  updateName(name: string): Promise<E.Either<Error, void>>;
  updatePassword(password: string): Promise<E.Either<Error, void>>;
}
