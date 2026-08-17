import { inject, Injectable, NgZone } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ChatStore } from './chat.store';

/**
 * App-wide realtime subscription that keeps the unread-messages count in sync
 * so the sidebar "Mensajes" badge updates the instant a WhatsApp message
 * arrives — no matter which page the admin is on. Mirror of
 * OrderBadgeRealtimeService (orders): own channel, owned by the always-mounted
 * sidebar, minimum work (a cheap recount) on any change to `chats` (los
 * inserts/updates de mensajes siempre tocan el chat: unread_count/last_message).
 */
@Injectable({ providedIn: 'root' })
export class ChatBadgeRealtimeService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);
  private readonly chatStore = inject(ChatStore);
  private readonly zone = inject(NgZone);
  private channel: RealtimeChannel | null = null;

  async start(): Promise<void> {
    this.stop();

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;

    // Seed the badge with the current count before the first realtime event.
    this.chatStore.loadUnreadTotal();

    this.channel = this.client
      .channel(`chats-badge-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => this.zone.run(() => this.chatStore.loadUnreadTotal())
      )
      // Cada (re)suscripción re-cuenta: supabase-js reintenta el socket solo y
      // así el badge se pone al día tras una caída sin lógica extra.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.zone.run(() => this.chatStore.loadUnreadTotal());
        }
      });
  }

  stop(): void {
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
