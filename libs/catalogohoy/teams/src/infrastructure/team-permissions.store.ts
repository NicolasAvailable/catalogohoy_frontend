import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { PermissionAction, PermissionKey, PermissionModule } from '../domain';
import { TeamService } from './team.service';
import { inject } from '@angular/core';

type TeamPermissionsState = {
  permissions: PermissionKey[];
  isOwner: boolean;
  isMember: boolean;
  isLoaded: boolean;
};

const initialState: TeamPermissionsState = {
  permissions: [],
  isOwner: false,
  isMember: false,
  isLoaded: false,
};

export const TeamPermissionsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    can: computed(() => (module: PermissionModule, action: PermissionAction): boolean => {
      if (store.isOwner()) return true;
      const key: PermissionKey = `${module}:${action}`;
      return store.permissions().includes(key);
    }),
    hasAccess: computed(() => store.isOwner() || store.isMember()),
  })),
  withMethods((store, teamService = inject(TeamService)) => ({
    async load(tenantId: number): Promise<void> {
      const result = await teamService.getMyPermissions(tenantId);
      result
        .mapRight(({ permissions, isOwner, isMember }) => {
          patchState(store, { permissions, isOwner, isMember, isLoaded: true });
        })
        .mapLeft(() => {
          patchState(store, { isLoaded: true });
        });
    },
    markAsLoaded(): void {
      patchState(store, { isLoaded: true });
    },
  }))
);
