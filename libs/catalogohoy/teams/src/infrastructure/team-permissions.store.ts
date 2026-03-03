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
      result
        .mapRight(({ permissions, isMember }) => {
          // Owner = authenticated user but NOT in team_members table
          const isOwner = !isMember;
          patchState(store, { permissions, isOwner, isLoaded: true });
        })
        .mapLeft(() => {
          // Even on error, mark as loaded so guards don't block indefinitely
          patchState(store, { isLoaded: true });
        });
    },
    markAsLoaded(): void {
      patchState(store, { isLoaded: true });
    },
  }))
);
