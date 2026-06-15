import { computed, inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { Chat, ChatMessage } from '../domain';
import { ChatService } from './chat.service';

type ChatState = {
  chats: Chat[];
  selectedChatId: number | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  searchQuery: string;
};

const initialState: ChatState = {
  chats: [],
  selectedChatId: null,
  messages: [],
  isLoading: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  searchQuery: '',
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
    })
  )
);
