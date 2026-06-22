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
};

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

      async sendMessage(content: string) {
        const chatId = store.selectedChatId();
        if (!chatId || !content.trim()) return;

        patchState(store, { isSendingMessage: true });

        const result = await chatService.sendMessage(chatId, content.trim(), true);

        result.fold(
          () => patchState(store, { isSendingMessage: false }),
          (msg) => {
            patchState(store, {
              messages: [...store.messages(), msg],
              isSendingMessage: false,
              chats: store.chats().map((c) =>
                c.id === chatId
                  ? { ...c, lastMessage: content.trim(), lastMessageAt: msg.createdAt }
                  : c
              ),
            });
          }
        );
      },

      /** Append a message that arrived via realtime (from the customer or
       *  another agent). Deduped by id so our own optimistic sends don't double
       *  up. Updates the conversation's preview/unread in the list too. */
      applyIncomingMessage(msg: ChatMessage) {
        const isSelected = store.selectedChatId() === msg.chatId;

        if (isSelected && !store.messages().some((m) => m.id === msg.id)) {
          patchState(store, { messages: [...store.messages(), msg] });
        }

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
            .sort((a, b) =>
              (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')
            ),
        });

        if (isSelected && !msg.isMine) {
          chatService.markAsRead(msg.chatId);
        }
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
