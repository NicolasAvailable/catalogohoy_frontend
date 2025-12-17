import { E } from '@shared/domain';
import { Profile } from './profile.model';

export interface BaseProfileService {
  profile(): Promise<E.Either<Error, Profile>>;
}
