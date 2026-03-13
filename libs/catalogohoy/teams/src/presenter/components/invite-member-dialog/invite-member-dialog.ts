import { Component, computed, inject, output, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, DialogComponent, IconComponent } from '@ui';
import { ToastService } from '@shared/infrastructure';
import { TeamStore } from '../../../infrastructure';
import { PermissionAction, PermissionKey, PermissionModule } from '../../../domain';
import { PermissionPickerComponent } from '../permission-picker/permission-picker';

@Component({
  selector: 'lib-invite-member-dialog',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, IconComponent, FormsModule, PermissionPickerComponent],
  templateUrl: './invite-member-dialog.html',
})
export class InviteMemberDialogComponent {
  readonly invited = output<void>();

  @ViewChild(DialogComponent) dialog!: DialogComponent;

  protected readonly teamStore = inject(TeamStore);
  private readonly toaster = inject(ToastService);

  protected email = signal('');
  protected errorMessage = signal<string | null>(null);
  protected readonly isEmailValid = computed(() =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim())
  );
  protected readonly selectedPermissions = signal<PermissionKey[]>([]);

  public show(): void {
    this.email.set('');
    this.errorMessage.set(null);
    this.selectedPermissions.set([]);
    this.dialog.show();
  }

  protected onPermissionsChange(keys: PermissionKey[]): void {
    this.selectedPermissions.set(keys);
  }

  protected async onInvite(): Promise<void> {
    const email = this.email().trim();
    if (!email) return;

    const perms = this.selectedPermissions().map((key) => {
      const [module, action] = key.split(':') as [PermissionModule, PermissionAction];
      return { module, action };
    });

    const error = await this.teamStore.inviteMember(email, perms);
    if (error) {
      this.errorMessage.set(error);
      return;
    }

    this.toaster.success('Invitación enviada correctamente');
    this.dialog.hide();
    this.invited.emit();
  }

  protected onCancel(): void {
    this.dialog.hide();
  }
}
