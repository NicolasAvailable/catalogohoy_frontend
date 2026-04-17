import { computed, inject } from '@angular/core';
import { PlanStore } from '@catalogohoy/plan';
import { TenantStore } from '@catalogohoy/tenant';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { PermissionAction, PermissionKey, PermissionModule, Team, TeamMember } from '../domain';
import { TeamService } from './team.service';

type TeamState = {
  teamId: number | null;
  members: TeamMember[];
  ownerEmail: string | null;
  ownerName: string | null;
  isLoading: boolean;
  isInviting: boolean;
  error: string | null;
};

const initialState: TeamState = {
  teamId: null,
  members: [],
  ownerEmail: null,
  ownerName: null,
  isLoading: false,
  isInviting: false,
  error: null,
};

export const TeamStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store, planStore = inject(PlanStore)) => ({
    memberCount: computed(() => store.members().filter((m) => m.status === 'accepted').length),
    pendingInvites: computed(() => store.members().filter((m) => m.status === 'pending')),
    acceptedMembers: computed(() => store.members().filter((m) => m.status === 'accepted')),
    canInviteMore: computed(() => {
      const max = planStore.maxTeamMembers();
      const accepted = store.members().filter((m) => m.status === 'accepted').length;
      return accepted < max;
    }),
  })),
  withMethods(
    (
      store,
      teamService = inject(TeamService),
      tenantStore = inject(TenantStore)
    ) => ({
      async load(): Promise<void> {
        patchState(store, { isLoading: true, error: null });

        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) {
          patchState(store, { isLoading: false });
          return;
        }

        const teamResult = await teamService.getOrCreateTeam(tenantId);
        if (teamResult.isLeft()) {
          patchState(store, { isLoading: false, error: (teamResult.value as Error).message });
          return;
        }

        const team = teamResult.value as Team;
        patchState(store, { teamId: team.id });

        const [membersResult, ownerResult] = await Promise.all([
          teamService.getMembers(team.id, tenantId),
          teamService.getOwnerInfo(tenantId),
        ]);

        const ownerInfo = ownerResult.isRight()
          ? (ownerResult.value as { email: string | null; name: string | null })
          : { email: null, name: null };

        membersResult
          .mapRight((members) => patchState(store, { members, ownerEmail: ownerInfo.email, ownerName: ownerInfo.name, isLoading: false }))
          .mapLeft((err) => patchState(store, { isLoading: false, error: err.message }));
      },

      async inviteMember(
        email: string,
        permissions: Array<{ module: PermissionModule; action: PermissionAction }> = []
      ): Promise<string | null> {
        const tenantId = await tenantStore.getTenantIdAsync();
        const teamId = store.teamId();
        if (!tenantId || !teamId) return 'No se pudo obtener información del equipo.';

        patchState(store, { isInviting: true, error: null });

        const result = await teamService.inviteMember({ teamId, email, tenantId, permissions });

        return result
          .mapRight((member) => {
            patchState(store, {
              members: [...store.members(), member],
              isInviting: false,
            });
            return null as string | null;
          })
          .mapLeft((err) => {
            patchState(store, { isInviting: false, error: err.message });
            return err.message;
          })
          .value as string | null;
      },

      async removeMember(memberId: number): Promise<void> {
        const result = await teamService.removeMember(memberId);
        result.mapRight(() => {
          patchState(store, {
            members: store.members().filter((m) => m.id !== memberId),
          });
        });
      },

      async getMemberPermissions(memberId: number): Promise<PermissionKey[] | null> {
        const result = await teamService.getMemberPermissions(memberId);
        return result
          .mapRight((perms) => perms as PermissionKey[] | null)
          .mapLeft(() => null as PermissionKey[] | null)
          .value as PermissionKey[] | null;
      },

      async savePermissions(
        memberId: number,
        perms: Array<{ module: PermissionModule; action: PermissionAction }>
      ): Promise<string | null> {
        const result = await teamService.updateMemberPermissions(memberId, perms);
        return result
          .mapRight(() => null as string | null)
          .mapLeft((err) => err.message)
          .value as string | null;
      },
    })
  )
);
