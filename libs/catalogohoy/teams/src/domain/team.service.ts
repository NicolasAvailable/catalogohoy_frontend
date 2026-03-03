import { E } from '@shared/domain';
import { PermissionAction, PermissionKey, PermissionModule } from './team-permission.model';
import { Team } from './team.model';
import { TeamMember } from './team-member.model';

export abstract class BaseTeamService {
  abstract getOrCreateTeam(tenantId: number): Promise<E.Either<Error, Team>>;
  abstract getMembers(teamId: number): Promise<E.Either<Error, TeamMember[]>>;
  abstract inviteMember(params: {
    teamId: number;
    email: string;
    tenantId: number;
  }): Promise<E.Either<Error, TeamMember>>;
  abstract removeMember(memberId: number): Promise<E.Either<Error, void>>;
  abstract updateMemberPermissions(
    memberId: number,
    perms: Array<{ module: PermissionModule; action: PermissionAction }>
  ): Promise<E.Either<Error, void>>;
  abstract getMyPermissions(tenantId: number): Promise<E.Either<Error, PermissionKey[]>>;
}
