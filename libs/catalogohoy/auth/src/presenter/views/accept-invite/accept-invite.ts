import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideAngularModule } from 'lucide-angular';
import { AuthenticationFacade } from '../../../application';

type InviteInfo = { email: string; tenantName: string; isRegistered: boolean };

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [LucideAngularModule, TranslocoPipe],
  templateUrl: './accept-invite.html',
})
export class AcceptInviteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facade = inject(AuthenticationFacade);

  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly inviteInfo = signal<InviteInfo | null>(null);

  private token: string | null = null;

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.queryParamMap.get('token');

    if (!this.token) {
      this.errorMessage.set('Token de invitación inválido o expirado.');
      this.isLoading.set(false);
      return;
    }

    const result = await this.facade.validateInviteToken(this.token);

    if (result.isLeft()) {
      this.errorMessage.set('La invitación no es válida o ha expirado.');
      this.isLoading.set(false);
      return;
    }

    this.inviteInfo.set(result.value as InviteInfo);
    this.isLoading.set(false);
  }

  protected onAccept(): void {
    const info = this.inviteInfo();
    if (!info || !this.token) return;

    sessionStorage.setItem('pending_invite_token', this.token);

    if (info.isRegistered) {
      this.router.navigate(['/login'], { queryParams: { invite_token: this.token } });
    } else {
      this.router.navigate(['/signup'], {
        queryParams: { invite_token: this.token, skip_store: 'true' },
      });
    }
  }
}
