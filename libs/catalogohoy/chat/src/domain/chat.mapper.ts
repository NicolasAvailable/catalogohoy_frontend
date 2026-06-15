import { Chat, ChatMessage } from './chat';

export class ChatMapper {
  static toDomain(raw: Record<string, unknown>): Chat {
    return {
      id: raw['id'] as number,
      tenantId: raw['tenant_id'] as number,
      orderId: raw['order_id'] as number | null,
      customerName: raw['customer_name'] as string,
      customerPhone: raw['customer_phone'] as string | null,
      lastMessage: raw['last_message'] as string | null,
      lastMessageAt: raw['last_message_at'] as string | null,
      unreadCount: raw['unread_count'] as number,
      muted: raw['muted'] as boolean,
      createdAt: raw['created_at'] as string,
    };
  }

  static toDomainList(raw: Record<string, unknown>[]): Chat[] {
    return raw.map(ChatMapper.toDomain);
  }
}

export class ChatMessageMapper {
  static toDomain(raw: Record<string, unknown>): ChatMessage {
    return {
      id: raw['id'] as number,
      chatId: raw['chat_id'] as number,
      content: raw['content'] as string,
      isMine: raw['is_mine'] as boolean,
      createdAt: raw['created_at'] as string,
    };
  }

  static toDomainList(raw: Record<string, unknown>[]): ChatMessage[] {
    return raw.map(ChatMessageMapper.toDomain);
  }
}
