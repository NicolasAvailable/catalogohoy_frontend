import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantStore } from '@catalogohoy/tenant';
import { ButtonComponent, IconComponent } from '@ui';
import { WhatsAppService } from '../../../infrastructure';

/** Pantalla dedicada "Conectar a TikTok" (espejo de la de Instagram).
 *  El canal usa la Business Messaging API de TikTok (beta): el cliente
 *  siempre escribe primero y el negocio responde dentro de una ventana de
 *  48 h (máx. 10 mensajes por ventana). El botón lanza tiktok-oauth con
 *  state firmado; al autorizar, el navegador aterriza en la bandeja. */
@Component({
  selector: 'lib-tiktok-connect',
  standalone: true,
  imports: [ButtonComponent, IconComponent, TranslocoPipe],
  templateUrl: './tiktok-connect.html',
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto' },
})
export class TikTokConnectComponent implements OnInit {
  private readonly whatsAppService = inject(WhatsAppService);
  private readonly tenantStore = inject(TenantStore);
  private readonly router = inject(Router);

  readonly ttAccount = signal<{
    username: string | null;
    displayName: string | null;
  } | null>(null);
  readonly isLoading = signal(true);
  readonly isStarting = signal(false);
  readonly hasError = signal(false);

  ngOnInit(): void {
    if (new URLSearchParams(window.location.search).get('tt') === 'error') {
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

    const returnUrl = `${window.location.origin}/admin/chat/conversations`;
    const result = await this.whatsAppService.startTikTokConnect(
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
    const result = await this.whatsAppService.getTikTokAccount(tenantId);
    result.fold(
      () => this.isLoading.set(false),
      (account) => {
        this.ttAccount.set(account);
        this.isLoading.set(false);
      }
    );
  }
}
