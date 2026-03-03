import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthenticationFacade } from '../../../application';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './accept-invite.html',
})
export class AcceptInviteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facade = inject(AuthenticationFacade);

  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.errorMessage.set('Token de invitación inválido o expirado.');
      this.isLoading.set(false);
      return;
    }

    const result = await this.facade.validateInviteToken(token);

    if (result.isLeft()) {
      this.errorMessage.set('La invitación no es válida o ha expirado.');
      this.isLoading.set(false);
      return;
    }

    const { isRegistered } = result.value as {
      email: string;
      tenantName: string;
      isRegistered: boolean;
    };

    sessionStorage.setItem('pending_invite_token', token);

    if (isRegistered) {
      this.router.navigate(['/login'], { queryParams: { invite_token: token } });
    } else {
      this.router.navigate(['/signup'], {
        queryParams: { invite_token: token, skip_store: 'true' },
      });
    }
  }
}
