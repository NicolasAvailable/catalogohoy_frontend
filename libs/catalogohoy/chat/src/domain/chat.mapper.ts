import {
  Chat,
  ChatMessage,
  ChatNote,
  PipelineStatus,
  QuickReply,
} from './chat';

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
      unreadCount: (raw['unread_count'] as number) ?? 0,
      muted: (raw['muted'] as boolean) ?? false,
      createdAt: raw['created_at'] as string,
      pipelineStatus: (raw['pipeline_status'] as string | null) ?? null,
      assignedToUserId: (raw['assigned_to_user_id'] as number | null) ?? null,
      internalNotes: Array.isArray(raw['internal_notes'])
        ? (raw['internal_notes'] as ChatNote[])
        : [],
      tags: Array.isArray(raw['tags']) ? (raw['tags'] as string[]) : [],
    };
  }

  static toDomainList(raw: Record<string, unknown>[]): Chat[] {
    return raw.map(ChatMapper.toDomain);
  }
}

export class PipelineStatusMapper {
  static toDomain(raw: Record<string, unknown>): PipelineStatus {
    return {
      id: raw['id'] as number,
      tenantId: raw['tenant_id'] as number,
      key: raw['key'] as string,
      name: raw['name'] as string,
      color: (raw['color'] as string) ?? '#6b7280',
      position: (raw['position'] as number) ?? 0,
    };
  }

  static toDomainList(raw: Record<string, unknown>[]): PipelineStatus[] {
    return raw.map(PipelineStatusMapper.toDomain);
  }
}

export class QuickReplyMapper {
  static toDomain(raw: Record<string, unknown>): QuickReply {
    return {
      id: raw['id'] as number,
      tenantId: raw['tenant_id'] as number,
      shortcut: raw['shortcut'] as string,
      content: raw['content'] as string,
      position: (raw['position'] as number) ?? 0,
    };
  }

  static toDomainList(raw: Record<string, unknown>[]): QuickReply[] {
    return raw.map(QuickReplyMapper.toDomain);
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
      type: (raw['message_type'] as ChatMessage['type']) ?? 'text',
      mediaUrl: (raw['media_url'] as string | null) ?? null,
    };
  }

  static toDomainList(raw: Record<string, unknown>[]): ChatMessage[] {
    return raw.map(ChatMessageMapper.toDomain);
  }
}
