import { computed, inject } from '@angular/core';
import { ProfileStore } from '@catalogohoy/profile';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { TenantStore } from '@catalogohoy/tenant';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { Chat, ChatMessage, ChatNote, PipelineStatus, QuickReply } from '../domain';
import { ChatService, SavedCustomer } from './chat.service';

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
  /** Total de mensajes sin leer del tenant (badge del sidebar, app-wide). */
  unreadTotal: number;
  /** true mientras el canal realtime está caído (banner "reconectando"). */
  realtimeDown: boolean;
  /** Clientes guardados del tenant (caché única) — resuelve apodos por
   *  teléfono en toda la bandeja. null = aún no cargó. */
  savedCustomers: SavedCustomer[] | null;
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
  unreadTotal: 0,
  realtimeDown: false,
  savedCustomers: null,
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
    /** Cliente guardado por teléfono normalizado a dígitos (lookup O(1)). */
    savedCustomerByDigits: computed(() => {
      const map = new Map<string, SavedCustomer>();
      for (const c of store.savedCustomers() ?? []) {
        const digits = c.phone.replace(/\D/g, '');
        if (digits) map.set(digits, c);
      }
      return map;
    }),
  })),
  withMethods(
    (
      store,
      chatService = inject(ChatService),
      tenantStore = inject(TenantStore),
      permissionsStore = inject(TeamPermissionsStore),
      profileStore = inject(ProfileStore)
    ) => {
      /** Un chat recién llegado sin responsable se autoasigna al owner del
       *  catálogo. Corre en la sesión del owner (la del comerciante, el caso
       *  normal); el UPDATE viaja por realtime al resto del equipo. Devuelve
       *  el chat ya asignado para pintarlo de una en la bandeja. */
      const autoAssignToOwner = (chat: Chat): Chat => {
        if (chat.assignedToUserId != null) return chat;
        if (!permissionsStore.isOwner()) return chat;
        const myId = profileStore.profile().id;
        if (typeof myId !== 'number') return chat;
        chatService.assign(chat.id, myId);
        return { ...chat, assignedToUserId: myId };
      };

      /** Evita fetches duplicados mientras la primera carga está en vuelo. */
      let savedCustomersRequested = false;

      return {
      /** Carga los clientes guardados del tenant — apodos para la lista, el
       *  header y la ficha. Con force=true refresca aunque ya haya caché (se
       *  usa al entrar al módulo, por si editaron apodos desde Clientes). */
      async loadSavedCustomers(force = false) {
        if (!force && (savedCustomersRequested || store.savedCustomers() !== null)) return;
        savedCustomersRequested = true;
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) {
          savedCustomersRequested = false;
          return;
        }
        const result = await chatService.getSavedCustomers(tenantId);
        patchState(store, {
          savedCustomers: result.isRight() ? result.value : [],
        });
      },

      /** Suma un cliente recién guardado a la caché (sin refetch). */
      addSavedCustomer(customer: SavedCustomer) {
        patchState(store, {
          savedCustomers: [...(store.savedCustomers() ?? []), customer],
        });
      },

      /** Apodo del cliente guardado con ese teléfono, o null. */
      nicknameFor(phone: string | null): string | null {
        if (!phone) return null;
        const digits = phone.replace(/\D/g, '');
        if (!digits) return null;
        return store.savedCustomerByDigits().get(digits)?.nickname ?? null;
      },

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

      /** Inicia (o reabre) una conversación de WhatsApp con un teléfono: si el
       *  tenant ya tiene chat con ese número lo devuelve; si no, lo crea y lo
       *  agrega a la bandeja. Devuelve el id listo para selectChat(), o null. */
      async startChat(name: string, phone: string): Promise<number | null> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return null;

        const found = await chatService.findWhatsAppChatByPhone(tenantId, phone);
        if (found.isLeft()) return null;

        let chat = found.value;
        if (!chat) {
          const created = await chatService.createChat(tenantId, name, phone);
          if (created.isLeft()) return null;
          chat = created.value;
        }

        if (!store.chats().some((c) => c.id === chat.id)) {
          patchState(store, {
            chats: [chat, ...store.chats()].sort(byLastMessageDesc),
          });
        }
        return chat.id;
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
        const clientKey = 'opt' + tempId;
        const now = new Date().toISOString();
        const optimistic: ChatMessage = {
          id: tempId,
          clientKey,
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
            c.id === chatId
              ? { ...c, lastMessage: text, lastMessageAt: now, lastMessageIsMine: true }
              : c
          ),
        });

        const result = await chatService.sendMessage(
          chatId,
          text,
          true,
          replyToId,
          store.selectedChat()?.channel ?? 'whatsapp'
        );

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
            // canal realtime ya la insertó). Conservamos la clientKey del
            // optimista para que el `@for` no recree la burbuja (sin parpadeo).
            const cleaned = store
              .messages()
              .filter((m) => m.id !== tempId && m.id !== msg.id);
            patchState(store, {
              messages: [...cleaned, { ...msg, clientKey }],
              isSendingMessage: false,
              chats: store.chats().map((c) =>
                c.id === chatId
                  ? {
                      ...c,
                      lastMessage: msg.content,
                      lastMessageAt: msg.createdAt,
                      lastMessageIsMine: true,
                    }
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
        const clientKey = 'opt' + tempId;
        const now = new Date().toISOString();
        const optimistic: ChatMessage = {
          id: tempId,
          clientKey,
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
              messages: [...cleaned, { ...msg, clientKey }],
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
        // El tipo lo define el archivo: imagen vs. documento (Excel, PDF, etc.).
        const isImageFile = file.type.startsWith('image/');
        const mediaType: 'image' | 'document' = isImageFile
          ? 'image'
          : 'document';
        const mediaLabel = isImageFile ? '📷 Imagen' : '📎 Documento';
        const tempId = nextTempId();
        const clientKey = 'opt' + tempId;
        const now = new Date().toISOString();
        const localUrl = URL.createObjectURL(file);
        const optimistic: ChatMessage = {
          id: tempId,
          clientKey,
          chatId,
          content: cap,
          isMine: true,
          createdAt: now,
          status: 'sending',
          type: mediaType,
          mediaUrl: localUrl,
          replyToMessageId: replyToId,
        };
        patchState(store, {
          messages: [...store.messages(), optimistic],
          isSendingMessage: true,
          replyingTo: null,
          chats: store.chats().map((c) =>
            c.id === chatId
              ? {
              ...c,
              lastMessage: cap || mediaLabel,
              lastMessageAt: now,
              lastMessageIsMine: true,
            }
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
          markFailed('No se pudo subir el archivo al servidor.');
          return;
        }

        const result = await chatService.sendMedia(
          chatId,
          up.value.url,
          mediaType,
          cap,
          replyToId,
          store.selectedChat()?.channel ?? 'whatsapp'
        );
        result.fold(
          (err) => markFailed(err.message),
          (msg) => {
            const cleaned = store
              .messages()
              .filter((m) => m.id !== tempId && m.id !== msg.id);
            patchState(store, {
              messages: [...cleaned, { ...msg, clientKey }],
              isSendingMessage: false,
              chats: store.chats().map((c) =>
                c.id === chatId
                  ? {
                      ...c,
                      lastMessage: msg.content,
                      lastMessageAt: msg.createdAt,
                      lastMessageIsMine: true,
                    }
                  : c
              ),
            });
          }
        );
      },

      setRealtimeDown(down: boolean) {
        patchState(store, { realtimeDown: down });
      },

      /** Recarga SILENCIOSA tras recuperar la conexión realtime (o tras volver
       *  de una pestaña dormida): trae lo que se haya perdido sin spinners ni
       *  parpadeos — lista de chats, mensajes del chat abierto y no-leídos. */
      async refreshAfterReconnect() {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return;

        const chatsResult = await chatService.getChatsByTenant(
          tenantId,
          store.searchQuery()
        );
        chatsResult.fold(
          () => undefined,
          (chats) => patchState(store, { chats })
        );

        const chatId = store.selectedChatId();
        if (chatId != null) {
          const msgs = await chatService.getMessagesByChatId(chatId);
          msgs.fold(
            () => undefined,
            (messages) => patchState(store, { messages })
          );
        }

        const unread = await chatService.getUnreadTotal(tenantId);
        unread.fold(
          () => undefined,
          (total) => patchState(store, { unreadTotal: total })
        );
      },

      /** Recalcula el total de no-leídos del tenant (badge del sidebar). Lo
       *  dispara ChatBadgeRealtimeService en cada cambio de `chats`. */
      async loadUnreadTotal() {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return;
        const result = await chatService.getUnreadTotal(tenantId);
        result.fold(
          () => undefined,
          (total) => patchState(store, { unreadTotal: total })
        );
      },

      /** Aplica un UPDATE de un mensaje llegado por realtime (acuse de entrega,
       *  transcripción hecha por otro agente…) sobre la conversación abierta. */
      applyMessageUpdate(msg: ChatMessage) {
        if (store.selectedChatId() !== msg.chatId) return;
        patchState(store, {
          messages: store
            .messages()
            .map((m) => (m.id === msg.id ? { ...m, ...msg } : m)),
        });
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
                      lastMessageIsMine: msg.isMine,
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
                const merged: Chat = autoAssignToOwner({
                  ...chat,
                  lastMessage: msg.content,
                  lastMessageAt: msg.createdAt,
                  unreadCount:
                    !msg.isMine && !isSelected
                      ? Math.max(chat.unreadCount, 1)
                      : chat.unreadCount,
                });
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
          chats: [autoAssignToOwner(chat), ...store.chats()].sort(byLastMessageDesc),
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

      /** Crea/edita una respuesta rápida y refresca la lista. */
      async saveQuickReply(payload: {
        id: number | null;
        shortcut: string;
        content: string;
      }): Promise<boolean> {
        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) return false;
        const result = await chatService.saveQuickReply(tenantId, payload);
        if (result.isLeft()) return false;
        const replies = await chatService.getQuickReplies(tenantId);
        if (replies.isRight()) patchState(store, { quickReplies: replies.value });
        return true;
      },

      /** Renombra el contacto (optimista) — se refleja en lista + header. */
      async renameChat(chatId: number, name: string) {
        patchState(store, {
          chats: store
            .chats()
            .map((c) => (c.id === chatId ? { ...c, customerName: name } : c)),
        });
        await chatService.updateCustomerName(chatId, name);
      },

      async deleteQuickReply(id: number) {
        const result = await chatService.deleteQuickReply(id);
        if (result.isRight()) {
          patchState(store, {
            quickReplies: store.quickReplies().filter((q) => q.id !== id),
          });
        }
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
      };
    }
  )
);
