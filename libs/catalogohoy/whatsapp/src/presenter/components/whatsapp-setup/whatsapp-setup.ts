import { Component, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonComponent, IconComponent } from '@ui';
import { WhatsAppAccount } from '../../../domain';
import { WhatsAppStore } from '../../../infrastructure';

@Component({
  selector: 'lib-whatsapp-setup',
  standalone: true,
  imports: [ButtonComponent, IconComponent, TranslocoPipe],
  templateUrl: './whatsapp-setup.html',
  host: { class: 'flex-1 flex min-h-0 min-w-0' },
})
export class WhatsAppSetupComponent {
  readonly whatsAppStore = inject(WhatsAppStore);
  readonly mode = input<'fullpage' | 'dialog'>('fullpage');
  readonly registered = output<WhatsAppAccount>();

  private readonly router = inject(Router);

  readonly signupComplete = signal(false);

  /** El alta real (Embedded Signup con coexistencia / solo API) vive en la
   *  página "Conectar a WhatsApp Business" — acá solo navegamos. */
  goToConnect(): void {
    this.router.navigate(['/admin/chat/connect']);
  }

  /** Connect a demo account so the inbox unlocks without the real Meta API. */
  async connectDemo(): Promise<void> {
    const account = await this.whatsAppStore.connectDemoAccount();
    if (account) {
      this.signupComplete.set(true);
      this.registered.emit(account);
    }
  }
}
