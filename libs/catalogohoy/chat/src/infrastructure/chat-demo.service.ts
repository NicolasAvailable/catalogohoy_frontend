import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { ChatMessage, ChatMessageMapper } from '../domain';

/** Anonymous-side service for the public customer simulator. It NEVER touches
 *  the chats/chat_messages tables directly — anon only gets two SECURITY DEFINER
 *  RPCs (post + fetch) scoped to a single chat, so no broad data is exposed.
 *  This stands in for the real WhatsApp inbound webhook while Meta approval is
 *  pending: the "customer" posts here, the agent inbox receives via realtime. */
@Injectable({ providedIn: 'root' })
export class ChatDemoService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Send a message as the customer. Finds-or-creates the conversation for
   *  (tenant, phone) and appends the message. Returns the chat id to poll. */
  async sendCustomerMessage(
    slug: string,
    phone: string,
    name: string,
    text: string
  ): Promise<E.Either<Error, number>> {
    const { data, error } = await this.client.rpc('post_demo_customer_message', {
      p_slug: slug,
      p_phone: phone,
      p_name: name,
      p_text: text,
    });
    if (error) return E.left(new Error(error.message));
    if (data == null) return E.left(new Error('No se pudo enviar el mensaje'));
    return E.right(Number(data));
  }

  /** Fetch the full thread for a chat (customer-visible). Polled by the
   *  simulator to show the agent's replies in near-real-time. The phone is
   *  verified server-side so anon can't enumerate other chats by id. */
  async getMessages(
    chatId: number,
    phone: string
  ): Promise<E.Either<Error, ChatMessage[]>> {
    const { data, error } = await this.client.rpc('get_demo_chat_messages', {
      p_chat_id: chatId,
      p_phone: phone,
    });
    if (error) return E.left(new Error(error.message));
    return E.right(
      ChatMessageMapper.toDomainList((data ?? []) as Record<string, unknown>[])
    );
  }
}
