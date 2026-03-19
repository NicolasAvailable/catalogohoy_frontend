import { inject } from '@angular/core';
import { PosthogService } from '@catalogohoy/core';
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
      tenantStore = inject(TenantStore),
      posthog = inject(PosthogService)
    ) => ({
      $profile() {
        patchState(store, () => ({ isLoading: true }));
        profileService.profile().then((profileResult) => {
          profileResult.mapRight((profile) => {
            tenantStore.setFromProfile(profile.tenantList, profile.id);

            // Identificar al admin en PostHog para asociar grabaciones y eventos
            posthog.identify(String(profile.id), {
              name: profile.name,
              email: profile.email,
            });

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
