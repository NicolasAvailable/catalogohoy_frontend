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

  // ── Reconexión: los navegadores estrangulan los websockets de pestañas en
  // segundo plano y el canal muere en silencio. Guardamos el tenant para poder
  // reabrir el canal (backoff) y recargar lo perdido al volver.
  private tenantId: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private wasDown = false;
  private lifecycleAttached = false;
  private hiddenAt: number | null = null;
  // Cada openChannel() incrementa la generación; los callbacks de estado de
  // canales reemplazados (removeChannel dispara su CLOSED) se ignoran para no
  // confundirlos con una caída real.
  private channelGen = 0;
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;

  async subscribe(): Promise<void> {
    this.unsubscribe();

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;
    this.tenantId = tenantId;
    this.attachLifecycleListeners();
    this.openChannel();
  }

  /** Abre (o reabre) el canal del tenant. */
  private openChannel(): void {
    const tenantId = this.tenantId;
    if (!tenantId) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const gen = ++this.channelGen;
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }

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
        { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
        // Acuses de entrega (✓→✓✓→✓✓ azul), transcripciones hechas por otro
        // agente, etc. — se pisa el mensaje en la conversación abierta.
        (payload) => {
          const msg = ChatMessageMapper.toDomain(
            payload.new as Record<string, unknown>
          );
          this.zone.run(() => this.chatStore.applyMessageUpdate(msg));
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
      .subscribe((status) => {
        if (gen !== this.channelGen) return; // canal viejo reemplazado
        this.zone.run(() => this.onChannelStatus(status));
      });
  }

  /** SUBSCRIBED tras una caída → recargar lo perdido; error/cierre → banner +
   *  reintento con backoff (2s, 4s, 8s… máx 30s). */
  private onChannelStatus(status: string): void {
    if (status === 'SUBSCRIBED') {
      this.reconnectAttempts = 0;
      this.clearBannerTimer();
      this.chatStore.setRealtimeDown(false);
      if (this.wasDown) {
        this.wasDown = false;
        this.chatStore.refreshAfterReconnect();
      }
      return;
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      if (!this.tenantId) return; // unsubscribe() intencional
      this.markDown();
      this.scheduleReconnect();
    }
  }

  /** Marca la caída pero muestra el banner solo si sigue caído unos segundos
   *  después — las reconexiones rápidas (p. ej. al volver a la pestaña) no
   *  parpadean la alerta. */
  private markDown(): void {
    this.wasDown = true;
    if (this.bannerTimer || this.chatStore.realtimeDown()) return;
    this.bannerTimer = setTimeout(() => {
      this.bannerTimer = null;
      if (this.wasDown) {
        this.zone.run(() => this.chatStore.setRealtimeDown(true));
      }
    }, 4_000);
  }

  private clearBannerTimer(): void {
    if (this.bannerTimer) {
      clearTimeout(this.bannerTimer);
      this.bannerTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(30_000, 2_000 * Math.pow(2, this.reconnectAttempts++));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openChannel();
    }, delay);
  }

  /** Al volver a la pestaña: si el canal murió, reabrir; si estuvo oculta un
   *  rato, recargar por si el socket "vivo" igual se perdió eventos. */
  private readonly onVisibility = (): void => {
    if (document.hidden) {
      this.hiddenAt = Date.now();
      return;
    }
    const hiddenFor = this.hiddenAt ? Date.now() - this.hiddenAt : 0;
    this.hiddenAt = null;
    if (!this.tenantId) return;

    if (this.channel?.state !== 'joined') {
      this.markDown();
      this.openChannel();
    } else if (hiddenFor > 60_000) {
      this.zone.run(() => this.chatStore.refreshAfterReconnect());
    }
  };

  private readonly onOnline = (): void => {
    if (!this.tenantId) return;
    this.markDown();
    this.openChannel();
  };

  private attachLifecycleListeners(): void {
    if (this.lifecycleAttached) return;
    this.lifecycleAttached = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('online', this.onOnline);
  }

  unsubscribe(): void {
    this.tenantId = null;
    this.channelGen++;
    this.clearBannerTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.lifecycleAttached) {
      document.removeEventListener('visibilitychange', this.onVisibility);
      window.removeEventListener('online', this.onOnline);
      this.lifecycleAttached = false;
    }
    this.wasDown = false;
    this.reconnectAttempts = 0;
    this.chatStore.setRealtimeDown(false);
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
