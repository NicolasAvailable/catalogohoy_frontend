import { computed, inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { Chat, ChatMessage, ChatNote, PipelineStatus, QuickReply } from '../domain';
import { ChatService } from './chat.service';

type ChatState = {
  chats: Chat[];
  selectedChatId: number | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  searchQuery: string;
  pipelineStatuses: PipelineStatus[];
  quickReplies: QuickReply[];
  /** Message the agent is composing a quoted reply to (null = none). */
  replyingTo: ChatMessage | null;
  /** Id of the voice note being transcribed with AI (null = none). */
  transcribingMessageId: number | null;
  /** Error de la última transcripción, anclado al mensaje que falló. */
  transcribeError: { messageId: number; message: string } | null;
};

const initialState: ChatState = {
  chats: [],
  selectedChatId: null,
  messages: [],
  isLoading: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  searchQuery: '',
  pipelineStatuses: [],
  quickReplies: [],
  replyingTo: null,
  transcribingMessageId: null,
  transcribeError: null,
};

/** Newest activity first; conversations without activity sink to the bottom. */
function byLastMessageDesc(a: Chat, b: Chat): number {
  return (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '');
}

/** Monotonic negative ids for optimistic messages (unique even when several are
 *  created in the same tick, e.g. sending multiple images at once). */
let tempIdSeq = 0;
function nextTempId(): number {
  return -++tempIdSeq;
}

export const ChatStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    filteredChats: computed(() => {
      const q = store.searchQuery().toLowerCase().trim();
      if (!q) return store.chats();
      return store.chats().filter((c) =>
        c.customerName.toLowerCase().includes(q)
      );
    }),
    selectedChat: computed(() => {
      const id = store.selectedChatId();
      if (id === null) return null;
      return store.chats().find((c) => c.id === id) ?? null;
    }),
    messagesByDay: computed(() => {
      const groups: Record<string, ChatMessage[]> = {};
      for (const msg of store.messages()) {
        const day = msg.createdAt.slice(0, 10);
        if (!groups[day]) groups[day] = [];
        groups[day].push(msg);
      }
      return Object.entries(groups).map(([date, msgs]) => ({ date, msgs }));
    }),
  })),
  withMethods(
    (
      store,
      chatService = inject(ChatService),
      tenantStore = inject(TenantStore)
    ) => ({
      // TODO(whatsapp-integration): paginar + loadMoreChats (infinite scroll con
      // cdk-virtual-scroll) cuando el volumen de conversaciones sea real. Por
      // ahora carga todo (mock).
      async loadChats() {
        patchState(store, { isLoading: true });

        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) {
          patchState(store, { isLoading: false });
          return;
        }

        const result = await chatService.getChatsByTenant(
          tenantId,
          store.searchQuery()
        );

        result.fold(
          () => patchState(store, { isLoading: false }),
          (chats) => patchState(store, { chats, isLoading: false })
        );
      },

      async selectChat(id: number) {
        patchState(store, { selectedChatId: id, isLoadingMessages: true });

        const result = await chatService.getMessagesByChatId(id);

        result.fold(
          () => patchState(store, { isLoadingMessages: false }),
          (messages) => patchState(store, { messages, isLoadingMessages: false })
        );

        await chatService.markAsRead(id);
        patchState(store, {
          chats: store.chats().map((c) =>
            c.id === id ? { ...c, unreadCount: 0 } : c
          ),
        });
      },

      /** Set (or clear) the message the agent is quoting in their next reply. */
      setReplyingTo(msg: ChatMessage | null) {
        patchState(store, { replyingTo: msg });
      },

      async sendMessage(content: string) {
        const chatId = store.selectedChatId();
        const text = content.trim();
        if (!chatId || !text) return;

        // Respuesta citada (sólo a mensajes ya persistidos = id positivo).
        const replyTo = store.replyingTo();
        const replyToId = replyTo && replyTo.id > 0 ? replyTo.id : null;

        // Render optimista: la burbuja aparece YA (con id temporal negativo y
        // estado 'sending'), sin esperar el round-trip de wa-send (cold start +
        // DB + Meta). Se reconcilia cuando responde.
        const tempId = nextTempId();
        const now = new Date().toISOString();
        const optimistic: ChatMessage = {
          id: tempId,
          chatId,
          content: text,
          isMine: true,
          createdAt: now,
          status: 'sending',
          replyToMessageId: replyToId,
        };
        patchState(store, {
          messages: [...store.messages(), optimistic],
          isSendingMessage: true,
          replyingTo: null,
          chats: store.chats().map((c) =>
            c.id === chatId ? { ...c, lastMessage: text, lastMessageAt: now } : c
          ),
        });

        const result = await chatService.sendMessage(chatId, text, true, replyToId);

        result.fold(
          (err) =>
            // Falló: marcar la burbuja optimista como 'failed' (no la borramos
            // para no perder lo escrito) y guardar el motivo.
            patchState(store, {
              isSendingMessage: false,
              messages: store.messages().map((m) =>
                m.id === tempId
                  ? { ...m, status: 'failed' as const, error: err.message }
                  : m
              ),
            }),
          (msg) => {
            // OK: reemplazar la temporal por la persistida (deduplicando si el
            // canal realtime ya la insertó).
            const cleaned = store
              .messages()
              .filter((m) => m.id !== tempId && m.id !== msg.id);
            patchState(store, {
              messages: [...cleaned, msg],
              isSendingMessage: false,
              chats: store.chats().map((c) =>
                c.id === chatId
                  ? { ...c, lastMessage: msg.content, lastMessageAt: msg.createdAt }
                  : c
              ),
            });
          }
        );
      },

      /** Add an internal note ("susurro") to the thread — team-only, optimistic. */
      async sendInternalNote(content: string) {
        const chatId = store.selectedChatId();
        const text = content.trim();
        if (!chatId || !text) return;

        const tempId = nextTempId();
        const now = new Date().toISOString();
        const optimistic: ChatMessage = {
          id: tempId,
          chatId,
          content: text,
          isMine: true,
          createdAt: now,
          status: 'sending',
          isInternal: true,
        };
        patchState(store, {
          messages: [...store.messages(), optimistic],
          isSendingMessage: true,
        });

        const result = await chatService.sendInternalNote(chatId, text);
        result.fold(
          (err) =>
            patchState(store, {
              isSendingMessage: false,
              messages: store.messages().map((m) =>
                m.id === tempId
                  ? { ...m, status: 'failed' as const, error: err.message }
                  : m
              ),
            }),
          (msg) => {
            const cleaned = store
              .messages()
              .filter((m) => m.id !== tempId && m.id !== msg.id);
            patchState(store, {
              messages: [...cleaned, msg],
              isSendingMessage: false,
            });
          }
        );
      },

      /** Send an image: optimistic bubble with a local preview, then upload to
       *  storage + wa-send, reconciling with the persisted message. */
      async sendMedia(file: File, caption = '') {
        const chat = store.selectedChat();
        const chatId = store.selectedChatId();
        if (!chat || !chatId) return;

        const replyTo = store.replyingTo();
        const replyToId = replyTo && replyTo.id > 0 ? replyTo.id : null;

        const cap = caption.trim();
        const tempId = nextTempId();
        const now = new Date().toISOString();
        const localUrl = URL.createObjectURL(file);
        const optimistic: ChatMessage = {
          id: tempId,
          chatId,
          content: cap,
          isMine: true,
          createdAt: now,
          status: 'sending',
          type: 'image',
          mediaUrl: localUrl,
          replyToMessageId: replyToId,
        };
        patchState(store, {
          messages: [...store.messages(), optimistic],
          isSendingMessage: true,
          replyingTo: null,
          chats: store.chats().map((c) =>
            c.id === chatId
              ? { ...c, lastMessage: cap || '📷 Imagen', lastMessageAt: now }
              : c
          ),
        });

        const markFailed = (reason?: string) =>
          patchState(store, {
            isSendingMessage: false,
            messages: store.messages().map((m) =>
              m.id === tempId
                ? { ...m, status: 'failed' as const, error: reason }
                : m
            ),
          });

        const up = await chatService.uploadMedia(file, chat.tenantId);
        if (up.isLeft()) {
          markFailed('No se pudo subir la imagen al servidor.');
          return;
        }

        const result = await chatService.sendMedia(chatId, up.value.url, 'image', cap, replyToId);
        result.fold(
          (err) => markFailed(err.message),
          (msg) => {
            const cleaned = store
              .messages()
              .filter((m) => m.id !== tempId && m.id !== msg.id);
            patchState(store, {
              messages: [...cleaned, msg],
              isSendingMessage: false,
              chats: store.chats().map((c) =>
                c.id === chatId
                  ? { ...c, lastMessage: msg.content, lastMessageAt: msg.createdAt }
                  : c
              ),
            });
          }
        );
      },

      /** Transcribe una nota de voz con IA (1 crédito) y guarda el texto en el
       *  mensaje. El backend es idempotente: re-pedir una ya transcrita es gratis. */
      async transcribeMessage(messageId: number) {
        if (store.transcribingMessageId()) return;
        patchState(store, {
          transcribingMessageId: messageId,
          transcribeError: null,
        });

        const result = await chatService.transcribeAudio(messageId);
        result.fold(
          (err) =>
            patchState(store, {
              transcribingMessageId: null,
              transcribeError: { messageId, message: err.message },
            }),
          (transcript) =>
            patchState(store, {
              transcribingMessageId: null,
              messages: store
                .messages()
                .map((m) => (m.id === messageId ? { ...m, transcript } : m)),
            })
        );
      },

      /** Append a message that arrived via realtime (from the customer or another
       *  agent). Updates the conversation IN PLACE — moves it to the top, refreshes
       *  preview/unread — WITHOUT reloading the whole list. If the message belongs
       *  to a conversation not yet in the inbox (brand-new contact), fetches just
       *  that chat and inserts it. Deduped by id so optimistic sends don't double up. */
      applyIncomingMessage(msg: ChatMessage) {
        const isSelected = store.selectedChatId() === msg.chatId;

        if (isSelected && !store.messages().some((m) => m.id === msg.id)) {
          patchState(store, { messages: [...store.messages(), msg] });
        }

        const known = store.chats().some((c) => c.id === msg.chatId);
        if (known) {
          patchState(store, {
            chats: store
              .chats()
              .map((c) =>
                c.id === msg.chatId
                  ? {
                      ...c,
                      lastMessage: msg.content,
                      lastMessageAt: msg.createdAt,
                      unreadCount:
                        !msg.isMine && !isSelected
                          ? c.unreadCount + 1
                          : c.unreadCount,
                    }
                  : c
              )
              .sort(byLastMessageDesc),
          });
        } else {
          // Conversación nueva que aún no está en la bandeja → traerla sola.
          chatService.getChatById(msg.chatId).then((res) =>
            res.fold(
              () => undefined,
              (chat) => {
                if (!chat || store.chats().some((c) => c.id === chat.id)) return;
                const merged: Chat = {
                  ...chat,
                  lastMessage: msg.content,
                  lastMessageAt: msg.createdAt,
                  unreadCount:
                    !msg.isMine && !isSelected
                      ? Math.max(chat.unreadCount, 1)
                      : chat.unreadCount,
                };
                patchState(store, {
                  chats: [merged, ...store.chats()].sort(byLastMessageDesc),
                });
              }
            )
          );
        }

        if (isSelected && !msg.isMine) {
          chatService.markAsRead(msg.chatId);
        }
      },

      /** Add a brand-new conversation to the inbox (from a realtime `chats`
       *  INSERT) without reloading the list. No-op if it's already there. */
      addChatIfNew(chat: Chat) {
        if (store.chats().some((c) => c.id === chat.id)) return;
        patchState(store, {
          chats: [chat, ...store.chats()].sort(byLastMessageDesc),
        });
      },

      /** Sync a chat's metadata (name, pipeline, assignee, mute, tags) from a
       *  realtime `chats` UPDATE, WITHOUT touching the locally-tracked activity
       *  fields (lastMessage/unread) — so the name updates live but we don't
       *  double-count unread nor reload the list. */
      updateChatFields(incoming: Chat) {
        if (!store.chats().some((c) => c.id === incoming.id)) return;
        patchState(store, {
          chats: store.chats().map((c) =>
            c.id === incoming.id
              ? {
                  ...c,
                  customerName: incoming.customerName,
                  pipelineStatus: incoming.pipelineStatus,
                  assignedToUserId: incoming.assignedToUserId,
                  muted: incoming.muted,
                  tags: incoming.tags,
                }
              : c
          ),
        });
      },

      /** Deselect the open conversation (mobile back button). */
      closeChat() {
        patchState(store, { selectedChatId: null, messages: [] });
      },

      setSearchQuery(q: string) {
        patchState(store, { searchQuery: q });
      },

      async toggleMute(id: number) {
        const chat = store.chats().find((c) => c.id === id);
        if (!chat) return;

        const newMuted = !chat.muted;
        await chatService.toggleMute(id, newMuted);
        patchState(store, {
          chats: store.chats().map((c) =>
            c.id === id ? { ...c, muted: newMuted } : c
          ),
        });
      },

      // ----------------------------------------------------------- CRM ---

      async loadCrmConfig() {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return;
        const [statuses, replies] = await Promise.all([
          chatService.getPipelineStatuses(tenantId),
          chatService.getQuickReplies(tenantId),
        ]);
        if (statuses.isRight())
          patchState(store, { pipelineStatuses: statuses.value });
        if (replies.isRight())
          patchState(store, { quickReplies: replies.value });
      },

      async setStatus(chatId: number, status: string | null) {
        patchState(store, {
          chats: store
            .chats()
            .map((c) => (c.id === chatId ? { ...c, pipelineStatus: status } : c)),
        });
        await chatService.updateStatus(chatId, status);
      },

      async assignChat(chatId: number, userId: number | null) {
        patchState(store, {
          chats: store
            .chats()
            .map((c) =>
              c.id === chatId ? { ...c, assignedToUserId: userId } : c
            ),
        });
        await chatService.assign(chatId, userId);
      },

      async addNote(chatId: number, note: ChatNote) {
        const chat = store.chats().find((c) => c.id === chatId);
        if (!chat) return;
        const notes = [...chat.internalNotes, note];
        patchState(store, {
          chats: store
            .chats()
            .map((c) => (c.id === chatId ? { ...c, internalNotes: notes } : c)),
        });
        await chatService.saveNotes(chatId, notes);
      },
    })
  )
);
