import { inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Profile } from '../domain';
import { ProfileService } from './profile.service';

type ProfileState = {
  profile: Profile;
  isLoading: boolean;
};

const initialState: ProfileState = {
  profile: Profile.empty(),
  isLoading: false,
};

export const ProfileStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (
      store,
      profileService = inject(ProfileService),
      tenantStore = inject(TenantStore)
    ) => ({
      $profile() {
        patchState(store, () => ({ isLoading: true }));
        profileService.profile().then((profileResult) => {
          profileResult.mapRight((profile) => {
            // Guardar el tenantList en el TenantStore
            tenantStore.setFromProfile(profile.tenantList);

            patchState(store, () => ({
              profile: profile,
              isLoading: false,
            }));
          });
        });
      },
    })
  )
);
