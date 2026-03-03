import { Component, computed, inject, output, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, DialogComponent, IconComponent } from '@ui';
import { ToastService } from '@shared/infrastructure';
import { TeamStore } from '../../../infrastructure';

@Component({
  selector: 'lib-invite-member-dialog',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, IconComponent, FormsModule],
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

  public show(): void {
    this.email.set('');
    this.errorMessage.set(null);
    this.dialog.show();
  }

  protected async onInvite(): Promise<void> {
    const email = this.email().trim();
    if (!email) return;

    const error = await this.teamStore.inviteMember(email);
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
