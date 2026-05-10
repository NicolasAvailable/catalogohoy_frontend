import { E } from '@shared/domain';
import { Profile } from './profile.model';

export interface NotificationPreferences {
  notifyPlanExpiry: boolean;
}

export interface BaseProfileService {
  profile(): Promise<E.Either<Error, Profile>>;
  updateName(name: string): Promise<E.Either<Error, void>>;
  updatePassword(password: string): Promise<E.Either<Error, void>>;
  updateNotificationPreferences(prefs: NotificationPreferences): Promise<E.Either<Error, void>>;
  deleteAccount(): Promise<E.Either<Error, void>>;
}
