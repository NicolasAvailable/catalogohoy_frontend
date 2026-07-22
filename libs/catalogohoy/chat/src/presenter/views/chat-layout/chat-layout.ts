import { Component, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatRealtimeService } from '../../../infrastructure/chat-realtime.service';
import { ChatStore } from '../../../infrastructure/chat.store';
import { ChatListPanelComponent } from '../../components/chat-list-panel/chat-list-panel';
import { ConversationPanelComponent } from '../../components/conversation-panel/conversation-panel';
import { CustomerPanelComponent } from '../../components/customer-panel/customer-panel';

@Component({
  selector: 'lib-chat-layout',
  standalone: true,
  imports: [
    ChatListPanelComponent,
    ConversationPanelComponent,
    CustomerPanelComponent,
    IconComponent,
    TranslocoPipe,
  ],
  host: { class: 'flex-1 flex min-h-0 overflow-hidden' },
  templateUrl: './chat-layout.html',
})
export class ChatLayoutComponent implements OnInit, OnDestroy {
  protected readonly chatStore = inject(ChatStore);
  private readonly realtime = inject(ChatRealtimeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private firstSelectionDone = false;

  constructor() {
    // Selección inicial: respeta ?chat=ID de la URL (link compartible); si no hay
    // o no existe, abre el primer chat. Se corre una sola vez al cargar la lista.
    effect(() => {
      const chats = this.chatStore.chats();
      if (this.firstSelectionDone) return;
      if (this.chatStore.selectedChatId() != null) {
        this.firstSelectionDone = true;
        return;
      }
      if (chats.length === 0) return;
      this.firstSelectionDone = true;
      const wanted = Number(this.route.snapshot.queryParamMap.get('chat'));
      const target = chats.find((c) => c.id === wanted) ?? chats[0];
      this.chatStore.selectChat(target.id);
    });

    // Reflejar el chat abierto en la URL (?chat=ID) para poder compartir el link.
    effect(() => {
      const id = this.chatStore.selectedChatId();
      if (id == null) return;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { chat: id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  reloadApp(): void {
    window.location.reload();
  }

  ngOnInit() {
    this.chatStore.loadChats();
    this.chatStore.loadCrmConfig();
    this.realtime.subscribe();
  }

  ngOnDestroy() {
    this.realtime.unsubscribe();
  }
}
