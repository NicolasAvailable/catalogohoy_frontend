export interface Chat {
  id: number;
  tenantId: number;
  orderId: number | null;
  customerName: string;
  customerPhone: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  muted: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: number;
  chatId: number;
  content: string;
  isMine: boolean;
  createdAt: string;
}
