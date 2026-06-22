import { Component, inject, OnDestroy, OnInit } from '@angular/core';
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
  ],
  host: { class: 'flex-1 flex min-h-0 overflow-hidden' },
  templateUrl: './chat-layout.html',
})
export class ChatLayoutComponent implements OnInit, OnDestroy {
  protected readonly chatStore = inject(ChatStore);
  private readonly realtime = inject(ChatRealtimeService);

  ngOnInit() {
    this.chatStore.loadChats();
    this.chatStore.loadCrmConfig();
    this.realtime.subscribe();
  }

  ngOnDestroy() {
    this.realtime.unsubscribe();
  }
}
