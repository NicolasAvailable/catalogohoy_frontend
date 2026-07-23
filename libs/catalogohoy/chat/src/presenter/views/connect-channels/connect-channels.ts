import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantStore } from '@catalogohoy/tenant';
import { WhatsAppService, WhatsAppStore } from '@catalogohoy/whatsapp';
import { NgClass } from '@angular/common';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { ConfirmDialogService, IconComponent } from '@ui';

/** Canal conectable desde el hub (estilo galería de SocialGest). */
interface ConnectableChannel {
  key: 'whatsapp' | 'instagram' | 'tiktok';
  name: string;
  logo: string;
  description: string;
  route: string;
  /** Card deshabilitada con badge "Próximamente" (canal aún no lanzado). */
  comingSoon?: boolean;
}

/** Cuenta social conectada (IG/TikTok) con sus columnas públicas. */
type SocialAccount = { username: string | null; displayName: string | null };

/** Hub "Conectar": las redes que el CRM puede conectar, cada una como card
 *  que lleva a su pantalla de conexión dedicada y muestra la cuenta conectada. */
@Component({
  selector: 'lib-connect-channels',
  standalone: true,
  imports: [NgClass, RouterLink, IconComponent, TranslocoPipe],
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto' },
  templateUrl: './connect-channels.html',
})
export class ConnectChannelsComponent implements OnInit {
  protected readonly whatsAppStore = inject(WhatsAppStore);
  private readonly whatsAppService = inject(WhatsAppService);
  private readonly tenantStore = inject(TenantStore);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  /** Canal cuya desvinculación está en vuelo (spinner por card). */
  protected readonly disconnectingKey = signal<string | null>(null);

  protected readonly igAccount = signal<SocialAccount | null>(null);
  protected readonly ttAccount = signal<SocialAccount | null>(null);

  protected readonly channels: ConnectableChannel[] = [
    {
      key: 'whatsapp',
      name: 'WhatsApp Business',
      logo: '/images/whatsapp.svg',
      description: 'Recibe y responde los chats de tu número de empresa.',
      route: '/admin/chat/connect/whatsapp',
    },
    {
      key: 'instagram',
      name: 'Instagram',
      logo: '/images/instagram.svg',
      description: 'Responde los mensajes directos de tu cuenta profesional.',
      route: '/admin/chat/connect/instagram',
      comingSoon: true,
    },
    {
      key: 'tiktok',
      name: 'TikTok',
      // Nota colorida sin fondo (tiktok.svg es la versión app-icon con fondo
      // negro, para los badges chicos de la bandeja).
      logo: '/images/tiktok-logo.svg',
      description: 'Mensajería de TikTok para empresas (beta).',
      route: '/admin/chat/connect/tiktok',
      comingSoon: true,
    },
  ];

  protected readonly waConnected = computed(() =>
    this.whatsAppStore.hasActiveAccount()
  );

  ngOnInit(): void {
    this.whatsAppStore.loadAccounts();
    this.loadSocialAccounts();
  }

  protected isConnected(channel: ConnectableChannel): boolean {
    if (channel.key === 'whatsapp') return this.waConnected();
    if (channel.key === 'instagram') return this.igAccount() !== null;
    return this.ttAccount() !== null;
  }

  /** Identidad visible de la cuenta conectada: número para WhatsApp, @usuario
   *  (o nombre) para las redes. */
  protected identityOf(channel: ConnectableChannel): string | null {
    if (channel.key === 'whatsapp') {
      const account = this.whatsAppStore.activeAccounts()[0];
      if (!account) return null;
      const phone = account.phoneNumber?.trim();
      const withPlus = phone
        ? phone.startsWith('+')
          ? phone
          : `+${phone}`
        : null;
      return account.displayName?.trim() || withPlus;
    }
    const account =
      channel.key === 'instagram' ? this.igAccount() : this.ttAccount();
    if (!account) return null;
    return account.username
      ? `@${account.username}`
      : account.displayName?.trim() || null;
  }

  private async loadSocialAccounts(): Promise<void> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;
    const [ig, tt] = await Promise.all([
      this.whatsAppService.getInstagramAccount(tenantId),
      this.whatsAppService.getTikTokAccount(tenantId),
    ]);
    if (ig.isRight()) this.igAccount.set(ig.value);
    if (tt.isRight()) this.ttAccount.set(tt.value);
  }

  /** Desvincular con confirmación: la cuenta pasa a inactiva pero los chats y
   *  datos quedan almacenados; se puede volver a conectar cuando quiera. */
  confirmDisconnect(channel: ConnectableChannel, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const identity = this.identityOf(channel) ?? channel.name;
    this.confirmDialog
      .warning({
        headerLabel: '¿Desvincular ' + channel.name + '?',
        target: identity,
        contentLabel:
          'Se desconectará la cuenta de tu bandeja. Tus chats y datos se conservan, y puedes volver a conectarla cuando quieras.',
        acceptLabel: 'Desvincular',
        rejectLabel: 'Cancelar',
      })
      .subscribe((result) => {
        result.mapRight(() => this.disconnect(channel));
      });
  }

  private async disconnect(channel: ConnectableChannel): Promise<void> {
    if (this.disconnectingKey()) return;
    this.disconnectingKey.set(channel.key);
    this.toast.wait('Desvinculando...');

    if (channel.key === 'whatsapp') {
      const account = this.whatsAppStore.activeAccounts()[0];
      if (!account) {
        this.disconnectingKey.set(null);
        this.toast.dismissWait();
        return;
      }
      const result = await this.whatsAppService.updateAccount(account.id, {
        status: 'inactive',
      });
      this.disconnectingKey.set(null);
      if (result.isLeft()) {
        this.toast.error(new Exception('No se pudo desvincular la cuenta'));
        return;
      }
      this.whatsAppStore.loadAccounts();
      this.toast.success('WhatsApp desvinculado. Tus chats quedan guardados.');
      return;
    }

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.disconnectingKey.set(null);
      this.toast.dismissWait();
      return;
    }
    const result = await this.whatsAppService.disconnectSocialAccount(
      tenantId,
      channel.key
    );
    this.disconnectingKey.set(null);
    if (result.isLeft()) {
      this.toast.error(new Exception('No se pudo desvincular la cuenta'));
      return;
    }
    if (channel.key === 'instagram') this.igAccount.set(null);
    else this.ttAccount.set(null);
    this.toast.success('Cuenta desvinculada. Tus chats quedan guardados.');
  }
}
