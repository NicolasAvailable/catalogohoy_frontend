import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import {
  Chat,
  ChatMessage,
  ChatMapper,
  ChatMessageMapper,
  ChatNote,
  PipelineStatus,
  PipelineStatusMapper,
  QuickReply,
  QuickReplyMapper,
} from '../domain';

/** A past order shown in the customer ficha. */
export interface CustomerOrderSummary {
  id: number;
  orderNumber: number | null;
  totalUsd: number;
  status: string;
  createdAt: string;
}

/** Cliente guardado (fila en `customers`) — para iniciar chats y para el
 *  badge "Cliente guardado" de la ficha. */
export interface SavedCustomer {
  id: number;
  name: string;
  /** Apodo con el que el comerciante reconoce al cliente (opcional). */
  nickname: string | null;
  phone: string;
}

/** Igualdad de teléfonos por dígitos, ignorando formato (+58 412… ≡ 0412…). */
const sameDigits = (a: string | null, b: string | null): boolean => {
  const da = (a ?? '').replace(/\D/g, '');
  return da.length > 0 && da === (b ?? '').replace(/\D/g, '');
};

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Conversations for the tenant, newest activity first.
   *  TODO(whatsapp-integration): paginar (offset/limit) y exponer loadMore para
   *  el infinite scroll del inbox una vez que el volumen sea real. Por ahora
   *  trae todo (mock). */
  async getChatsByTenant(
    tenantId: number,
    search?: string
  ): Promise<E.Either<Error, Chat[]>> {
    let query = this.client
      .from('chats')
      .select('*')
      .eq('tenant_id', tenantId);

    if (search?.trim()) {
      query = query.ilike('customer_name', `%${search.trim()}%`);
    }

    const { data, error } = await query.order('last_message_at', {
      ascending: false,
      nullsFirst: false,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(ChatMapper.toDomainList(data || []));
  }

  /** Chat de WhatsApp del tenant con ese teléfono (comparado por dígitos), si
   *  existe — para reabrirlo en vez de duplicarlo al "iniciar" una conversación. */
  async findWhatsAppChatByPhone(
    tenantId: number,
    phone: string
  ): Promise<E.Either<Error, Chat | null>> {
    const { data, error } = await this.client
      .from('chats')
      .select('*')
      .eq('tenant_id', tenantId)
      .not('customer_phone', 'is', null);
    if (error) return E.left(new Error(error.message));

    const row = (data ?? []).find(
      (r: { channel: string | null; customer_phone: string | null }) =>
        (r.channel ?? 'whatsapp') === 'whatsapp' &&
        sameDigits(r.customer_phone, phone)
    );
    return E.right(row ? ChatMapper.toDomain(row) : null);
  }

  /** Crea una conversación de WhatsApp vacía con un contacto (número nuevo o
   *  cliente guardado). El primer mensaje sale después por el composer normal. */
  async createChat(
    tenantId: number,
    name: string,
    phone: string
  ): Promise<E.Either<Error, Chat>> {
    // Mismo formato que los chats creados por el webhook: wa_id = dígitos sin '+'.
    const waPhone = phone.replace(/\D/g, '');
    const { data, error } = await this.client
      .from('chats')
      .insert({
        tenant_id: tenantId,
        customer_name: name.trim() || `+${waPhone}`,
        customer_phone: waPhone,
        channel: 'whatsapp',
      })
      .select()
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(ChatMapper.toDomain(data));
  }

  /** Clientes guardados del tenant con teléfono (tabla `customers`), para el
   *  diálogo de nuevo chat y el lookup de la ficha. */
  async getSavedCustomers(
    tenantId: number
  ): Promise<E.Either<Error, SavedCustomer[]>> {
    const { data, error } = await this.client
      .from('customers')
      .select('id, name, nickname, phone')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });
    if (error) return E.left(new Error(error.message));
    return E.right(
      ((data ?? []) as {
        id: number;
        name: string | null;
        nickname?: string | null;
        phone: string | null;
      }[])
        .filter((r) => (r.phone ?? '').replace(/\D/g, '').length > 0)
        .map((r) => ({
          id: r.id,
          name: r.name ?? 'Cliente',
          nickname: r.nickname ?? null,
          phone: r.phone as string,
        }))
    );
  }

  /** Guarda el contacto del chat como cliente (fila mínima en `customers`). */
  async saveCustomerFromChat(
    tenantId: number,
    name: string,
    phone: string,
    nickname: string | null = null
  ): Promise<E.Either<Error, SavedCustomer>> {
    // En customers el teléfono se guarda legible, con '+' internacional.
    const clean = phone.trim();
    const withPlus = clean.startsWith('+')
      ? clean
      : `+${clean.replace(/\D/g, '')}`;
    const { data, error } = await this.client
      .from('customers')
      .insert({
        tenant_id: tenantId,
        name: name.trim() || 'Cliente',
        nickname: (nickname ?? '').trim() || null,
        phone: withPlus,
      })
      .select('id, name, nickname, phone')
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right({
      id: data.id as number,
      name: (data.name as string) ?? 'Cliente',
      nickname: (data.nickname as string | null) ?? null,
      phone: (data.phone as string) ?? phone,
    });
  }

  /** Single conversation by id — used by realtime to add a brand-new chat to the
   *  inbox incrementally (without reloading the whole list). */
  async getChatById(id: number): Promise<E.Either<Error, Chat | null>> {
    const { data, error } = await this.client
      .from('chats')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return E.left(new Error(error.message));
    return E.right(data ? ChatMapper.toDomain(data) : null);
  }

  async getMessagesByChatId(
    chatId: number
  ): Promise<E.Either<Error, ChatMessage[]>> {
    const { data, error } = await this.client
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(ChatMessageMapper.toDomainList(data || []));
  }

  async sendMessage(
    chatId: number,
    content: string,
    isMine: boolean,
    replyToId: number | null = null,
    channel: Chat['channel'] = 'whatsapp'
  ): Promise<E.Either<Error, ChatMessage>> {
    // Instagram/TikTok: siempre por su función de envío (sin fallback demo —
    // la ventana de mensajería y los errores de la plataforma deben llegarle
    // claros al agente).
    if (isMine && (channel === 'instagram' || channel === 'tiktok')) {
      const fn = channel === 'instagram' ? 'ig-send' : 'tiktok-send';
      return this.invokeSend(fn, { chatId, text: content });
    }
    // Respuesta del agente → intentar enviarla de verdad por WhatsApp. `wa-send`
    // envía con el token del comerciante y persiste el mensaje server-side.
    if (isMine) {
      const { data, error } = await this.client.functions.invoke('wa-send', {
        body: { chatId, text: content, replyToMessageId: replyToId ?? undefined },
      });

      if (!error && data?.success && data?.message) {
        return E.right(ChatMessageMapper.toDomain(data.message));
      }

      // 409 = el tenant no tiene número real conectado (modo demo) → cae al insert
      // directo de abajo. Cualquier otro error (p.ej. ventana de 24h) se propaga.
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && ctx.status !== 409) {
        let message = 'No se pudo enviar el mensaje';
        try {
          const b = await ctx.clone().json();
          if (b?.error) {
            message =
              typeof b.error === 'string'
                ? b.error
                : (b.error?.message ?? message);
          }
        } catch {
          /* sin cuerpo legible */
        }
        return E.left(new Error(message));
      }
    }

    // Inserción directa: modo demo (agente) o mensaje entrante (is_mine=false).
    const { data: msgData, error: msgError } = await this.client
      .from('chat_messages')
      .insert({
        chat_id: chatId,
        content,
        is_mine: isMine,
        reply_to_message_id: replyToId,
      })
      .select()
      .single();

    if (msgError) {
      return E.left(new Error(msgError.message));
    }

    const updatePayload: Record<string, unknown> = {
      last_message: content,
      last_message_at: new Date().toISOString(),
      last_message_is_mine: isMine,
    };

    if (!isMine) {
      const { data: chatData } = await this.client
        .from('chats')
        .select('unread_count')
        .eq('id', chatId)
        .single();
      updatePayload['unread_count'] = ((chatData?.['unread_count'] as number) ?? 0) + 1;
    }

    await this.client.from('chats').update(updatePayload).eq('id', chatId);

    return E.right(ChatMessageMapper.toDomain(msgData));
  }

  /** Upload an image/file to the public `catalogohoy` bucket and return its URL. */
  async uploadMedia(
    file: File,
    tenantId: number
  ): Promise<E.Either<Error, { url: string; mime: string }>> {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `chat-media/${tenantId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;
    const { error } = await this.client.storage
      .from('catalogohoy')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return E.left(new Error(error.message));
    const { data } = this.client.storage.from('catalogohoy').getPublicUrl(path);
    return E.right({ url: data.publicUrl, mime: file.type });
  }

  /** Send a media message (image/document) via wa-send, with a demo fallback
   *  (direct insert) when the tenant has no real WhatsApp token (409). */
  async sendMedia(
    chatId: number,
    mediaUrl: string,
    mediaType: 'image' | 'document',
    caption: string,
    replyToId: number | null = null,
    channel: Chat['channel'] = 'whatsapp'
  ): Promise<E.Either<Error, ChatMessage>> {
    if (channel === 'instagram' || channel === 'tiktok') {
      const fn = channel === 'instagram' ? 'ig-send' : 'tiktok-send';
      const name = channel === 'instagram' ? 'Instagram' : 'TikTok';
      if (mediaType !== 'image') {
        return E.left(new Error(`${name} solo permite enviar imágenes desde la bandeja`));
      }
      // Ni IG ni TikTok soportan caption en attachments: la imagen va primero
      // y el texto como mensaje aparte.
      const sent = await this.invokeSend(fn, { chatId, mediaUrl });
      if (sent.isLeft() || !caption.trim()) return sent;
      return this.invokeSend(fn, { chatId, text: caption.trim() });
    }
    const label = mediaType === 'document' ? '📎 Documento' : '📷 Imagen';
    const { data, error } = await this.client.functions.invoke('wa-send', {
      body: {
        chatId,
        mediaUrl,
        mediaType,
        text: caption,
        replyToMessageId: replyToId ?? undefined,
      },
    });

    if (!error && data?.success && data?.message) {
      return E.right(ChatMessageMapper.toDomain(data.message));
    }

    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && ctx.status !== 409) {
      let message = 'No se pudo enviar el archivo';
      try {
        const b = await ctx.clone().json();
        if (b?.error) {
          message =
            typeof b.error === 'string' ? b.error : (b.error?.message ?? message);
        }
      } catch {
        /* sin cuerpo legible */
      }
      return E.left(new Error(message));
    }

    // Demo (sin token real): insertar directo con la media.
    const { data: msgData, error: msgError } = await this.client
      .from('chat_messages')
      .insert({
        chat_id: chatId,
        content: caption || label,
        is_mine: true,
        message_type: mediaType,
        media_url: mediaUrl,
        reply_to_message_id: replyToId,
      })
      .select()
      .single();
    if (msgError) return E.left(new Error(msgError.message));

    await this.client
      .from('chats')
      .update({
        last_message: caption || label,
        last_message_at: new Date().toISOString(),
        last_message_is_mine: true,
      })
      .eq('id', chatId);

    return E.right(ChatMessageMapper.toDomain(msgData));
  }

  /** Invoca una función de envío (wa-send / ig-send / tiktok-send) y mapea la
   *  respuesta {success, message} | {error} al Either del dominio. */
  private async invokeSend(
    fn: 'wa-send' | 'ig-send' | 'tiktok-send',
    body: Record<string, unknown>
  ): Promise<E.Either<Error, ChatMessage>> {
    const { data, error } = await this.client.functions.invoke(fn, { body });
    if (!error && data?.success && data?.message) {
      return E.right(ChatMessageMapper.toDomain(data.message));
    }
    let message = 'No se pudo enviar el mensaje';
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx) {
      try {
        const b = await ctx.clone().json();
        if (b?.error) {
          message = typeof b.error === 'string' ? b.error : (b.error?.message ?? message);
        }
      } catch {
        /* sin cuerpo legible */
      }
    } else if (data?.error) {
      message = typeof data.error === 'string' ? data.error : message;
    }
    return E.left(new Error(message));
  }

  /** Total de mensajes sin leer del tenant (suma de unread_count de sus
   *  chats) — alimenta el badge "Mensajes" del sidebar. */
  async getUnreadTotal(tenantId: number): Promise<E.Either<Error, number>> {
    const { data, error } = await this.client
      .from('chats')
      .select('unread_count')
      .eq('tenant_id', tenantId)
      .gt('unread_count', 0);
    if (error) return E.left(new Error(error.message));
    const total = (data ?? []).reduce(
      (acc, row) => acc + ((row['unread_count'] as number) ?? 0),
      0
    );
    return E.right(total);
  }

  /** Transcribe a voice note with AI (wa-transcribe → Whisper, 1 crédito).
   *  Idempotente: si el mensaje ya tiene transcript, el backend lo devuelve
   *  sin cobrar. */
  async transcribeAudio(messageId: number): Promise<E.Either<Error, string>> {
    const { data, error } = await this.client.functions.invoke('wa-transcribe', {
      body: { messageId },
    });

    if (!error && data?.success && data?.transcript) {
      return E.right(data.transcript as string);
    }

    let message = 'No se pudo transcribir el audio';
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx) {
      try {
        const b = await ctx.clone().json();
        if (b?.error) {
          message =
            typeof b.error === 'string' ? b.error : (b.error?.message ?? message);
        }
      } catch {
        /* sin cuerpo legible */
      }
    } else if (data?.error) {
      message = typeof data.error === 'string' ? data.error : message;
    }
    return E.left(new Error(message));
  }

  /** Add an internal team note ("susurro") to the thread — NOT sent to WhatsApp.
   *  No actualiza el preview del chat (es una anotación del equipo). */
  async sendInternalNote(
    chatId: number,
    content: string
  ): Promise<E.Either<Error, ChatMessage>> {
    const { data, error } = await this.client
      .from('chat_messages')
      .insert({ chat_id: chatId, content, is_mine: true, is_internal: true })
      .select()
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(ChatMessageMapper.toDomain(data));
  }

  async markAsRead(chatId: number): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('chats')
      .update({ unread_count: 0 })
      .eq('id', chatId);

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }

  async toggleMute(
    chatId: number,
    muted: boolean
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('chats')
      .update({ muted })
      .eq('id', chatId);

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }

  // ----------------------------------------------------------------- CRM ---

  async updateStatus(
    chatId: number,
    pipelineStatus: string | null
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('chats')
      .update({ pipeline_status: pipelineStatus })
      .eq('id', chatId);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  async assign(
    chatId: number,
    userId: number | null
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('chats')
      .update({ assigned_to_user_id: userId })
      .eq('id', chatId);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  async saveNotes(
    chatId: number,
    notes: ChatNote[]
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('chats')
      .update({ internal_notes: notes })
      .eq('id', chatId);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  async getPipelineStatuses(
    tenantId: number
  ): Promise<E.Either<Error, PipelineStatus[]>> {
    const { data, error } = await this.client
      .from('pipeline_statuses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true });
    if (error) return E.left(new Error(error.message));
    return E.right(PipelineStatusMapper.toDomainList(data || []));
  }

  async getQuickReplies(
    tenantId: number
  ): Promise<E.Either<Error, QuickReply[]>> {
    const { data, error } = await this.client
      .from('quick_replies')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true });
    if (error) return E.left(new Error(error.message));
    return E.right(QuickReplyMapper.toDomainList(data || []));
  }

  /** Crea o actualiza una respuesta rápida del tenant (RLS: miembros). */
  async saveQuickReply(
    tenantId: number,
    payload: { id: number | null; shortcut: string; content: string }
  ): Promise<E.Either<Error, QuickReply>> {
    const shortcut = payload.shortcut.trim().replace(/^\/+/, '').toLowerCase();
    const content = payload.content.trim();
    const query = payload.id
      ? this.client
          .from('quick_replies')
          .update({ shortcut, content })
          .eq('id', payload.id)
      : this.client
          .from('quick_replies')
          .insert({ tenant_id: tenantId, shortcut, content });
    const { data, error } = await query.select().single();
    if (error) return E.left(new Error(error.message));
    return E.right(QuickReplyMapper.toDomain(data));
  }

  /** Renombra el contacto/lead de la conversación. */
  async updateCustomerName(
    chatId: number,
    name: string
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('chats')
      .update({ customer_name: name })
      .eq('id', chatId);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  async deleteQuickReply(id: number): Promise<E.Either<Error, void>> {
    const { error } = await this.client.from('quick_replies').delete().eq('id', id);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  /** Past orders for the customer phone, for the ficha. Matches on digits so a
   *  "+58 412…" order links to a "0412…" chat. */
  async getCustomerOrders(
    tenantId: number,
    phone: string | null
  ): Promise<E.Either<Error, CustomerOrderSummary[]>> {
    if (!phone) return E.right([]);
    const { data, error } = await this.client
      .from('orders')
      .select('id, order_number, total_usd, status, created_at, phone')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return E.left(new Error(error.message));

    const target = phone.replace(/\D/g, '');
    return E.right(
      (data || [])
        .filter(
          (o: { phone: string | null }) =>
            (o.phone ?? '').replace(/\D/g, '') === target
        )
        .map(
          (o: {
            id: number;
            order_number: number | null;
            total_usd: number | string;
            status: string | null;
            created_at: string;
          }) => ({
            id: o.id,
            orderNumber: o.order_number ?? null,
            totalUsd: Number(o.total_usd) || 0,
            status: o.status ?? 'pending',
            createdAt: o.created_at,
          })
        )
    );
  }
}
