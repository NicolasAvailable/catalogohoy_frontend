import { inject, Injectable } from '@angular/core';
import { ProfileService } from '../infrastructure';
import {
  UpdateNameInput,
  UpdateNameUseCase,
} from './update-name/update-name.usecase';

@Injectable({
  providedIn: 'root',
})
export class ProfileFacade {
  public readonly profileService = inject(ProfileService);

  public updateName(name: UpdateNameInput) {
    return new UpdateNameUseCase(this.profileService).execute(name);
  }
}
