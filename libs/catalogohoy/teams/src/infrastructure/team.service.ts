import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import {
  BaseTeamService,
  PermissionAction,
  PermissionKey,
  PermissionModule,
  Team,
  TeamMember,
} from '../domain';

@Injectable({ providedIn: 'root' })
export class TeamService implements BaseTeamService {
  private readonly client = SupabaseClientProvider.getInstance();

  public async getOrCreateTeam(tenantId: number): Promise<E.Either<Error, Team>> {
    const { data: existing, error: fetchError } = await this.client
      .from('teams')
      .select('id, tenant_id, created_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError) return E.left(new Error(fetchError.message));

    if (existing) {
      return E.right({
        id: existing.id,
        tenantId: existing.tenant_id,
        createdAt: existing.created_at,
      });
    }

    const { data: created, error: createError } = await this.client
      .from('teams')
      .insert({ tenant_id: tenantId })
      .select('id, tenant_id, created_at')
      .single();

    if (createError) return E.left(new Error(createError.message));

    return E.right({
      id: created.id,
      tenantId: created.tenant_id,
      createdAt: created.created_at,
    });
  }

  public async getMembers(teamId: number): Promise<E.Either<Error, TeamMember[]>> {
    const { data, error } = await this.client
      .from('team_members')
      .select('id, team_id, user_id, invited_email, status, invite_token, invite_expires_at, created_at, users(name, last_name)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (error) return E.left(new Error(error.message));

    const members: TeamMember[] = (data ?? []).map((row: any) => ({
      id: row.id,
      teamId: row.team_id,
      userId: row.user_id,
      invitedEmail: row.invited_email,
      status: row.status,
      inviteToken: row.invite_token,
      inviteExpiresAt: row.invite_expires_at,
      createdAt: row.created_at,
      userName: row.users?.name ?? null,
      userLastName: row.users?.last_name ?? null,
    }));

    return E.right(members);
  }

  public async inviteMember(params: {
    teamId: number;
    email: string;
    tenantId: number;
    permissions?: Array<{ module: PermissionModule; action: PermissionAction }>;
  }): Promise<E.Either<Error, TeamMember>> {
    const { data, error } = await this.client.functions.invoke<{
      id: number;
      team_id: number;
      user_id: number | null;
      invited_email: string;
      status: string;
      invite_token: string;
      invite_expires_at: string | null;
      created_at: string;
    }>('invite-team-member', {
      body: {
        teamId: params.teamId,
        email: params.email,
        tenantId: params.tenantId,
        permissions: params.permissions ?? [],
      },
    });

    if (error) return E.left(new Error(error.message));
    if (!data) return E.left(new Error('No se recibió respuesta del servidor'));

    return E.right({
      id: data.id,
      teamId: data.team_id,
      userId: data.user_id,
      invitedEmail: data.invited_email,
      status: data.status as TeamMember['status'],
      inviteToken: data.invite_token,
      inviteExpiresAt: data.invite_expires_at,
      createdAt: data.created_at,
      userName: null,
      userLastName: null,
    });
  }

  public async removeMember(memberId: number): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  public async updateMemberPermissions(
    memberId: number,
    perms: Array<{ module: PermissionModule; action: PermissionAction }>
  ): Promise<E.Either<Error, void>> {
    const { error: deleteError } = await this.client
      .from('team_member_permissions')
      .delete()
      .eq('team_member_id', memberId);

    if (deleteError) return E.left(new Error(deleteError.message));

    if (perms.length === 0) return E.right(undefined);

    const rows = perms.map((p) => ({
      team_member_id: memberId,
      module: p.module,
      action: p.action,
    }));

    const { error: insertError } = await this.client
      .from('team_member_permissions')
      .insert(rows);

    if (insertError) return E.left(new Error(insertError.message));
    return E.right(undefined);
  }

  public async getMemberPermissions(memberId: number): Promise<E.Either<Error, PermissionKey[]>> {
    const { data, error } = await this.client
      .from('team_member_permissions')
      .select('module, action')
      .eq('team_member_id', memberId);

    if (error) return E.left(new Error(error.message));

    const permissions = (data ?? []).map(
      (row) => `${row.module}:${row.action}` as PermissionKey
    );
    return E.right(permissions);
  }

  public async getOwnerInfo(tenantId: number): Promise<E.Either<Error, { email: string | null; name: string | null }>> {
    const { data, error } = await this.client
      .from('users_tenants')
      .select('users(email, name, last_name)')
      .eq('tenant_id', tenantId)
      .eq('role', 'owner')
      .maybeSingle();

    if (error) return E.left(new Error(error.message));
    const user = (data as any)?.users;
    const name = user?.name
      ? `${user.name}${user.last_name ? ' ' + user.last_name : ''}`
      : null;
    return E.right({ email: user?.email ?? null, name });
  }

  public async getMyPermissions(
    tenantId: number
  ): Promise<E.Either<Error, { permissions: PermissionKey[]; isMember: boolean; isOwner: boolean }>> {
    const { data, error } = await this.client.rpc('get_my_team_permissions', {
      p_tenant_id: tenantId,
    });

    if (error) return E.left(new Error(error.message));

    const rows = (data as Array<{ module: string; action: string; is_member: boolean; is_owner: boolean }>) ?? [];
    const isMember = rows.some((r) => r.is_member);
    const isOwner = rows.some((r) => r.is_owner);
    const permissions = rows
      .filter((r) => r.module !== '')
      .map((r) => `${r.module}:${r.action}` as PermissionKey);

    return E.right({ permissions, isMember, isOwner });
  }
}
