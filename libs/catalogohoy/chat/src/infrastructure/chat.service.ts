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
    isMine: boolean
  ): Promise<E.Either<Error, ChatMessage>> {
    // Respuesta del agente → intentar enviarla de verdad por WhatsApp. `wa-send`
    // envía con el token del comerciante y persiste el mensaje server-side.
    if (isMine) {
      const { data, error } = await this.client.functions.invoke('wa-send', {
        body: { chatId, text: content },
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
      .insert({ chat_id: chatId, content, is_mine: isMine })
      .select()
      .single();

    if (msgError) {
      return E.left(new Error(msgError.message));
    }

    const updatePayload: Record<string, unknown> = {
      last_message: content,
      last_message_at: new Date().toISOString(),
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
    caption: string
  ): Promise<E.Either<Error, ChatMessage>> {
    const label = mediaType === 'document' ? '📎 Documento' : '📷 Imagen';
    const { data, error } = await this.client.functions.invoke('wa-send', {
      body: { chatId, mediaUrl, mediaType, text: caption },
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
      })
      .select()
      .single();
    if (msgError) return E.left(new Error(msgError.message));

    await this.client
      .from('chats')
      .update({ last_message: caption || label, last_message_at: new Date().toISOString() })
      .eq('id', chatId);

    return E.right(ChatMessageMapper.toDomain(msgData));
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
