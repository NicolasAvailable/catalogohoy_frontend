import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantStore } from '@catalogohoy/tenant';
import { ButtonComponent, IconComponent } from '@ui';
import { WhatsAppService } from '../../../infrastructure';

/** Pantalla dedicada "Conectar a Instagram" (espejo de la de WhatsApp): logo
 *  grande, requisitos y el botón que lanza el Instagram Login (ig-oauth con
 *  state firmado — redirect server-side, funciona desde cualquier dominio).
 *  Al autorizar, el navegador aterriza en la bandeja con el chat de IG abierto. */
@Component({
  selector: 'lib-instagram-connect',
  standalone: true,
  imports: [ButtonComponent, IconComponent, TranslocoPipe],
  templateUrl: './instagram-connect.html',
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto' },
})
export class InstagramConnectComponent implements OnInit {
  private readonly whatsAppService = inject(WhatsAppService);
  private readonly tenantStore = inject(TenantStore);
  private readonly router = inject(Router);

  readonly igAccount = signal<{
    username: string | null;
    displayName: string | null;
  } | null>(null);
  readonly isLoading = signal(true);
  readonly isStarting = signal(false);
  readonly hasError = signal(false);

  ngOnInit(): void {
    if (new URLSearchParams(window.location.search).get('ig') === 'error') {
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

    // Al autorizar, ig-oauth devuelve a la bandeja con el chat de IG abierto.
    const returnUrl = `${window.location.origin}/admin/chat/conversations`;
    const result = await this.whatsAppService.startInstagramConnect(
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
    const result = await this.whatsAppService.getInstagramAccount(tenantId);
    result.fold(
      () => this.isLoading.set(false),
      (account) => {
        this.igAccount.set(account);
        this.isLoading.set(false);
      }
    );
  }
}
