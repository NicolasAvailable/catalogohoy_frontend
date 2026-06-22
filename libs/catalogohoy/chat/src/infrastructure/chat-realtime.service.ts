import { inject, Injectable, NgZone } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ChatMessageMapper } from '../domain';
import { ChatStore } from './chat.store';

/** Live updates for the inbox. Subscribes to the tenant's `chat_messages`
 *  inserts (new messages → appended/marked in the store) and `chats` changes
 *  (new conversations / preview / unread → list reload). RLS scopes realtime to
 *  the tenant, so no explicit tenant filter is needed on chat_messages (which
 *  has no tenant_id column). */
@Injectable({ providedIn: 'root' })
export class ChatRealtimeService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);
  private readonly chatStore = inject(ChatStore);
  private readonly zone = inject(NgZone);
  private channel: RealtimeChannel | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  async subscribe(): Promise<void> {
    this.unsubscribe();

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;

    this.channel = this.client
      .channel(`chat-tenant-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = ChatMessageMapper.toDomain(
            payload.new as Record<string, unknown>
          );
          this.zone.run(() => this.chatStore.applyIncomingMessage(msg));
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => this.zone.run(() => this.debouncedReloadChats())
      )
      .subscribe();
  }

  unsubscribe(): void {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }
  }

  /** New conversations / list-level changes are coalesced so a burst of inserts
   *  triggers a single reload. */
  private debouncedReloadChats(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      this.chatStore.loadChats();
      this.reloadTimer = null;
    }, 600);
  }
}
