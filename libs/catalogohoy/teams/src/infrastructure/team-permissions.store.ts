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
  isLoaded: boolean;
};

const initialState: TeamPermissionsState = {
  permissions: [],
  isOwner: false,
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
  })),
  withMethods((store, teamService = inject(TeamService)) => ({
    async load(tenantId: number): Promise<void> {
      const result = await teamService.getMyPermissions(tenantId);
      result.mapRight((permissions) => {
        // Empty array from the RPC means the user is the owner
        const isOwner = permissions.length === 0;
        patchState(store, { permissions, isOwner, isLoaded: true });
      });
    },
  }))
);
