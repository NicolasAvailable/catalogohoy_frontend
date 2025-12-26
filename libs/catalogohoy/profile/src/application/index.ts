import { inject, Injectable } from '@angular/core';
import { ProfileService } from '../infrastructure';
import {
  UpdateNameInput,
  UpdateNameUseCase,
} from './update-name/update-name.usecase';
import {
  UpdatePasswordInput,
  UpdatePasswordUseCase,
} from './update-password/update-password.usecase';

@Injectable({
  providedIn: 'root',
})
export class ProfileFacade {
  public readonly profileService = inject(ProfileService);

  public updateName(name: UpdateNameInput) {
    return new UpdateNameUseCase(this.profileService).execute(name);
  }

  public updatePassword(password: UpdatePasswordInput) {
    return new UpdatePasswordUseCase(this.profileService).execute(password);
  }
}
