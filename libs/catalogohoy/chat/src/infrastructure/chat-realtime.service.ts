import { inject, Injectable, NgZone } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ChatMapper, ChatMessageMapper } from '../domain';
import { ChatStore } from './chat.store';

/** Live updates for the inbox. Subscribes to the tenant's `chat_messages`
 *  inserts (new messages → appended/updated in place) and `chats` INSERTs (new
 *  conversations → added to the list). Everything is **incremental**: the inbox
 *  is never fully reloaded, so the conversation list doesn't flicker/hide when a
 *  message arrives. RLS scopes realtime to the tenant. */
@Injectable({ providedIn: 'root' })
export class ChatRealtimeService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);
  private readonly chatStore = inject(ChatStore);
  private readonly zone = inject(NgZone);
  private channel: RealtimeChannel | null = null;
  private audioCtx: AudioContext | null = null;

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
          this.zone.run(() => {
            this.chatStore.applyIncomingMessage(msg);
            if (!msg.isMine) this.notifyIncoming(msg.chatId);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chats',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const chat = ChatMapper.toDomain(
            payload.new as Record<string, unknown>
          );
          this.zone.run(() => this.chatStore.addChatIfNew(chat));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chats',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const chat = ChatMapper.toDomain(
            payload.new as Record<string, unknown>
          );
          this.zone.run(() => this.chatStore.updateChatFields(chat));
        }
      )
      .subscribe();
  }

  unsubscribe(): void {
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }
  }

  /** Ping + (si está permitida) notificación del navegador al llegar un mensaje
   *  entrante, salvo que la conversación esté silenciada. */
  private notifyIncoming(chatId: number): void {
    const chat = this.chatStore.chats().find((c) => c.id === chatId);
    if (chat?.muted) return;

    this.playPing();

    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      typeof document !== 'undefined' &&
      document.hidden
    ) {
      new Notification('Nuevo mensaje', {
        body: chat?.customerName ?? 'Tienes un mensaje nuevo',
      });
    }
  }

  /** Tono corto de "ding" generado por Web Audio (sin assets). */
  private playPing(): void {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.audioCtx ??= new Ctor();
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.12);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Audio no disponible (autoplay bloqueado, etc.) — silencioso.
    }
  }
}
