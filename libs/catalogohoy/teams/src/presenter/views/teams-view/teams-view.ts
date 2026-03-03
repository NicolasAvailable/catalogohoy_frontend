import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { Exception } from '@shared/domain';
import { PlanStore } from '@catalogohoy/plan';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent, ConfirmDialogComponent } from '@ui';
import { ToastService } from '@shared/infrastructure';
import { SkeletonModule } from 'primeng/skeleton';
import { TeamPermissionsStore } from '../../../infrastructure/team-permissions.store';
import { TeamStore } from '../../../infrastructure/team.store';
import { MODULE_ACTIONS, PermissionAction, PermissionKey, PermissionModule, TeamMember } from '../../../domain';
import { InviteMemberDialogComponent } from '../../components/invite-member-dialog/invite-member-dialog';
import { PermissionPickerComponent } from '../../components/permission-picker/permission-picker';
import { FormsModule } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'lib-teams-view',
  standalone: true,
  imports: [
    LucideAngularModule,
    ButtonComponent,
    ConfirmDialogComponent,
    InviteMemberDialogComponent,
    PermissionPickerComponent,
    FormsModule,
    TooltipModule,
    SkeletonModule,
  ],
  templateUrl: './teams-view.html',
  styleUrl: './teams-view.css',
})
export default class TeamsViewComponent implements OnInit {
  protected readonly teamStore = inject(TeamStore);
  protected readonly planStore = inject(PlanStore);
  protected readonly permissionsStore = inject(TeamPermissionsStore);
  private readonly toaster = inject(ToastService);

  protected readonly canInvite = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('equipo', 'invite')
  );
  protected readonly canEditPermissions = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('equipo', 'edit')
  );
  protected readonly canRemove = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('equipo', 'delete')
  );

  protected readonly totalPermissions = Object.values(MODULE_ACTIONS).reduce(
    (sum, actions) => sum + actions.length,
    0
  );

  protected readonly expandedMemberId = signal<number | null>(null);
  protected readonly memberPermissionsCache = signal<Record<number, PermissionKey[] | undefined>>({});
  protected readonly savingMemberId = signal<number | null>(null);
  protected readonly pendingRemoveMemberId = signal<number | null>(null);

  @ViewChild(InviteMemberDialogComponent) inviteDialog!: InviteMemberDialogComponent;
  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  async ngOnInit(): Promise<void> {
    await this.planStore.loadTenantPlanUsage();
    await this.teamStore.load();
    await Promise.all(
      this.teamStore.acceptedMembers().map(async (member) => {
        const perms = await this.teamStore.getMemberPermissions(member.id);
        this.memberPermissionsCache.update((cache) => ({
          ...cache,
          [member.id]: perms ?? [],
        }));
      })
    );
  }

  protected openInviteDialog(): void {
    this.inviteDialog.show();
  }

  protected async togglePermissions(member: TeamMember): Promise<void> {
    const currentExpanded = this.expandedMemberId();
    if (currentExpanded === member.id) {
      this.expandedMemberId.set(null);
      return;
    }
    this.expandedMemberId.set(member.id);
    if (this.memberPermissionsCache()[member.id] === undefined) {
      const perms = await this.teamStore.getMemberPermissions(member.id);
      this.memberPermissionsCache.update((cache) => ({
        ...cache,
        [member.id]: perms ?? [],
      }));
    }
  }

  protected async onSavePermissions(event: {
    memberId: number;
    permissions: PermissionKey[];
  }): Promise<void> {
    this.savingMemberId.set(event.memberId);
    const perms = event.permissions.map((key) => {
      const [module, action] = key.split(':') as [PermissionModule, PermissionAction];
      return { module, action };
    });
    const error = await this.teamStore.savePermissions(event.memberId, perms);
    this.savingMemberId.set(null);
    if (error) {
      this.toaster.error(new Exception(error));
      return;
    }
    this.memberPermissionsCache.update((cache) => ({
      ...cache,
      [event.memberId]: event.permissions,
    }));
    this.toaster.success('Permisos actualizados');
  }

  protected onCancelPermissions(): void {
    this.expandedMemberId.set(null);
  }

  protected removeMember(memberId: number): void {
    this.pendingRemoveMemberId.set(memberId);
    this.confirmDialog.warning();
  }

  protected async onConfirmRemove(): Promise<void> {
    const memberId = this.pendingRemoveMemberId();
    if (memberId === null) return;
    const member = this.teamStore.members().find((m) => m.id === memberId);
    await this.teamStore.removeMember(memberId);
    this.pendingRemoveMemberId.set(null);
    if (member?.status === 'pending') {
      this.toaster.success('Invitación cancelada');
    } else {
      this.toaster.success('Miembro eliminado del equipo');
    }
  }

  protected getConfirmRemoveContent(): string {
    const memberId = this.pendingRemoveMemberId();
    if (memberId === null) return '';
    const member = this.teamStore.members().find((m) => m.id === memberId);
    if (member?.status === 'pending') {
      return `¿Cancelar la invitación enviada a <strong>${member.invitedEmail}</strong>?`;
    }
    return `¿Eliminar a <strong>${member?.invitedEmail}</strong> del equipo? Perderá acceso inmediatamente.`;
  }

  protected getMemberInitial(email: string): string {
    return email.charAt(0).toUpperCase();
  }
}
