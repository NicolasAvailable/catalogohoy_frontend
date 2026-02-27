import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Chat, ChatMessage, ChatMapper, ChatMessageMapper } from '../domain';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly client = SupabaseClientProvider.getInstance();

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
}
