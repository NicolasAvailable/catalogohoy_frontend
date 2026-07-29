/** Canal por el que entra la conversación (bandeja omnicanal). */
export type ChatChannel = 'whatsapp' | 'instagram' | 'tiktok' | 'messenger';

export interface Chat {
  id: number;
  tenantId: number;
  orderId: number | null;
  customerName: string;
  customerPhone: string | null;
  /** Canal de la conversación (default whatsapp). */
  channel: ChatChannel;
  /** Id del cliente en redes sin teléfono (IGSID de IG / open_id de TikTok). */
  externalUserId: string | null;
  /** Username visible del cliente en la red (sin @). */
  customerUsername: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  /** true si el último mensaje lo mandó el negocio (preview "Tú: …"). */
  lastMessageIsMine: boolean | null;
  unreadCount: number;
  muted: boolean;
  createdAt: string;
  // --- CRM ---
  /** Key of the pipeline status this conversation is in (configurable). */
  pipelineStatus: string | null;
  /** users.id of the team member responsible for this conversation. */
  assignedToUserId: number | null;
  /** Admin-only notes thread (never sent to the customer). */
  internalNotes: ChatNote[];
  tags: string[];
}

export interface ChatNote {
  author: string;
  text: string;
  createdAt: string;
}

export interface ChatMessage {
  id: number;
  chatId: number;
  content: string;
  isMine: boolean;
  createdAt: string;
  /** Optimistic delivery state for outgoing messages (only set client-side):
   *  'sending' while wa-send is in flight, 'failed' if it errored. Real persisted
   *  messages leave it undefined. */
  status?: 'sending' | 'failed';
  /** Reason a 'failed' message couldn't be sent (shown on hover). Client-only. */
  error?: string;
  /** Message kind. 'text' (default) or a media type. */
  type?: 'text' | 'image' | 'document' | 'video' | 'audio';
  /** Public URL of the attached media (image/document), when type !== 'text'. */
  mediaUrl?: string | null;
  /** AI transcript of a voice note (type 'audio'), generated on demand. */
  transcript?: string | null;
  /** WhatsApp delivery receipt for outgoing messages (✓ / ✓✓ / ✓✓ azul, o
   *  'failed' si Meta no lo pudo entregar). Null para entrantes, notas internas
   *  y mensajes del modo demo. */
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed' | null;
  /** Motivo legible de una entrega fallida (delivery_status='failed'). */
  deliveryError?: string | null;
  /** WhatsApp message id (wamid) — used to map quoted replies. */
  waMessageId?: string | null;
  /** Local id of the message this one replies to (quoted reply), if any. */
  replyToMessageId?: number | null;
  /** Internal team note ("susurro") — not sent to the customer. */
  isInternal?: boolean;
  /** Identidad estable para el `@for` del hilo, sólo cliente. El mensaje
   *  optimista nace con una clientKey y la conserva al reconciliarse con el
   *  persistido (cuyo `id` cambia de temporal negativo a real), evitando que
   *  Angular destruya y recree la burbuja al pasar de "enviando" a "enviado". */
  clientKey?: string;
}

/** A configurable kanban/pipeline stage for the tenant's CRM. */
export interface PipelineStatus {
  id: number;
  tenantId: number;
  key: string;
  name: string;
  color: string;
  position: number;
}

/** A reusable canned response the team can insert into the composer. */
export interface QuickReply {
  id: number;
  tenantId: number;
  shortcut: string;
  content: string;
  position: number;
}
