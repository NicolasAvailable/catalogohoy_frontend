import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { PlanStore } from '@catalogohoy/plan';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '@ui';
import { ToastService } from '@shared/infrastructure';
import { TeamPermissionsStore } from '../../../infrastructure/team-permissions.store';
import { TeamStore } from '../../../infrastructure/team.store';
import { PermissionAction, PermissionKey, PermissionModule, TeamMember } from '../../../domain';
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
    InviteMemberDialogComponent,
    PermissionPickerComponent,
    FormsModule,
    TooltipModule,
  ],
  templateUrl: './teams-view.html',
  styleUrl: './teams-view.css',
})
export default class TeamsViewComponent implements OnInit {
  protected readonly teamStore = inject(TeamStore);
  protected readonly planStore = inject(PlanStore);
  protected readonly permissionsStore = inject(TeamPermissionsStore);
  private readonly toaster = inject(ToastService);

  protected readonly expandedMemberId = signal<number | null>(null);
  protected readonly memberPermissionsCache = signal<Record<number, PermissionKey[]>>({});
  protected readonly savingMemberId = signal<number | null>(null);

  @ViewChild(InviteMemberDialogComponent) inviteDialog!: InviteMemberDialogComponent;

  async ngOnInit(): Promise<void> {
    await this.planStore.loadTenantPlanUsage();
    await this.teamStore.load();
  }

  protected openInviteDialog(): void {
    this.inviteDialog.show();
  }

  protected togglePermissions(member: TeamMember): void {
    const currentExpanded = this.expandedMemberId();
    if (currentExpanded === member.id) {
      this.expandedMemberId.set(null);
      return;
    }
    this.expandedMemberId.set(member.id);
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
    await this.teamStore.savePermissions(event.memberId, perms);
    this.savingMemberId.set(null);
    this.expandedMemberId.set(null);
  }

  protected onCancelPermissions(): void {
    this.expandedMemberId.set(null);
  }

  protected async removeMember(memberId: number): Promise<void> {
    const member = this.teamStore.members().find((m) => m.id === memberId);
    await this.teamStore.removeMember(memberId);
    if (member?.status === 'pending') {
      this.toaster.success('Invitación cancelada');
    } else {
      this.toaster.success('Miembro eliminado del equipo');
    }
  }

  protected getMemberInitial(email: string): string {
    return email.charAt(0).toUpperCase();
  }
}
