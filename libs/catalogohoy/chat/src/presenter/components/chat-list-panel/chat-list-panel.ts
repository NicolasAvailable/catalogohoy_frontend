import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantStore } from '@catalogohoy/tenant';
import { WhatsAppService, WhatsAppStore } from '@catalogohoy/whatsapp';
import { IconComponent, InputSearchComponent } from '@ui';
import { ChatStore } from '../../../infrastructure/chat.store';

@Component({
  selector: 'lib-chat-list-panel',
  standalone: true,
  imports: [IconComponent, InputSearchComponent, RouterLink, TranslocoPipe],
  templateUrl: './chat-list-panel.html',
})
export class ChatListPanelComponent {
  protected readonly chatStore = inject(ChatStore);
  private readonly whatsAppStore = inject(WhatsAppStore);
  private readonly whatsAppService = inject(WhatsAppService);
  private readonly tenantStore = inject(TenantStore);

  /** Conexión de IG/TikTok/Messenger (null = aún no consultado → no banner). */
  private readonly igConnected = signal<boolean | null>(null);
  private readonly ttConnected = signal<boolean | null>(null);
  private readonly fbConnected = signal<boolean | null>(null);

  /** Ningún canal conectado (pero hay historial, si no la vista sería el
   *  empty state): banner de aviso con CTA a Conectar. */
  protected readonly noChannelsConnected = computed(
    () =>
      !this.whatsAppStore.isLoading() &&
      !this.whatsAppStore.hasActiveAccount() &&
      this.igConnected() === false &&
      this.ttConnected() === false &&
      this.fbConnected() === false
  );

  constructor() {
    this.tenantStore.getTenantIdAsync().then(async (tenantId) => {
      if (!tenantId) return;
      const [ig, tt, fb] = await Promise.all([
        this.whatsAppService.getInstagramAccount(tenantId),
        this.whatsAppService.getTikTokAccount(tenantId),
        this.whatsAppService.getMessengerAccount(tenantId),
      ]);
      if (ig.isRight()) this.igConnected.set(ig.value !== null);
      if (tt.isRight()) this.ttConnected.set(tt.value !== null);
      if (fb.isRight()) this.fbConnected.set(fb.value !== null);
    });
  }

  onSearch(query: string) {
    this.chatStore.setSearchQuery(query);
    this.chatStore.loadChats();
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('es', { weekday: 'short' });
    }
    return date.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
  }

  /** Primer nombre del contacto para el prefijo del preview ("Gaby: …"). */
  firstName(name: string): string {
    return (name ?? '').trim().split(/\s+/)[0] ?? '';
  }

  initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
}
