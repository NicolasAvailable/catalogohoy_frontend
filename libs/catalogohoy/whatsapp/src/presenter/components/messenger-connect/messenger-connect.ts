import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantStore } from '@catalogohoy/tenant';
import { ButtonComponent, IconComponent } from '@ui';
import { WhatsAppService } from '../../../infrastructure';

/** Pantalla dedicada "Conectar a Messenger" (espejo de la de Instagram): logo
 *  grande, requisitos y el botón que lanza el Facebook Login (fb-oauth con
 *  state firmado — redirect server-side, funciona desde cualquier dominio).
 *  Al autorizar, el navegador aterriza en la bandeja con el chat de Messenger. */
@Component({
  selector: 'lib-messenger-connect',
  standalone: true,
  imports: [ButtonComponent, IconComponent, TranslocoPipe],
  templateUrl: './messenger-connect.html',
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto' },
})
export class MessengerConnectComponent implements OnInit {
  private readonly whatsAppService = inject(WhatsAppService);
  private readonly tenantStore = inject(TenantStore);
  private readonly router = inject(Router);

  readonly fbAccount = signal<{
    username: string | null;
    displayName: string | null;
  } | null>(null);
  readonly isLoading = signal(true);
  readonly isStarting = signal(false);
  readonly hasError = signal(false);

  ngOnInit(): void {
    if (new URLSearchParams(window.location.search).get('fb') === 'error') {
      this.hasError.set(true);
    }
    this.loadAccount();
  }

  goBack(): void {
    this.router.navigate(['/admin/chat/connect']);
  }

  goToInbox(): void {
    this.router.navigate(['/admin/chat/conversations']);
  }

  async connect(): Promise<void> {
    if (this.isStarting()) return;
    this.isStarting.set(true);
    this.hasError.set(false);

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.isStarting.set(false);
      return;
    }

    // Al autorizar, fb-oauth devuelve a la bandeja con el chat de Messenger abierto.
    const returnUrl = `${window.location.origin}/admin/chat/conversations`;
    const result = await this.whatsAppService.startMessengerConnect(
      tenantId,
      returnUrl
    );
    result.fold(
      () => {
        this.hasError.set(true);
        this.isStarting.set(false);
      },
      (url) => {
        window.location.href = url;
      }
    );
  }

  private async loadAccount(): Promise<void> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.isLoading.set(false);
      return;
    }
    const result = await this.whatsAppService.getMessengerAccount(tenantId);
    result.fold(
      () => this.isLoading.set(false),
      (account) => {
        this.fbAccount.set(account);
        this.isLoading.set(false);
      }
    );
  }
}
