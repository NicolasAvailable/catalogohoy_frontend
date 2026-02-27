import { Component, inject, OnInit } from '@angular/core';
import { ChatStore } from '../../../infrastructure/chat.store';
import { ChatListPanelComponent } from '../../components/chat-list-panel/chat-list-panel';
import { ConversationPanelComponent } from '../../components/conversation-panel/conversation-panel';

@Component({
  selector: 'lib-chat-layout',
  standalone: true,
  imports: [ChatListPanelComponent, ConversationPanelComponent],
  host: { class: 'flex-1 flex min-h-0 overflow-hidden' },
  templateUrl: './chat-layout.html',
})
export class ChatLayoutComponent implements OnInit {
  protected readonly chatStore = inject(ChatStore);

  ngOnInit() {
    this.chatStore.loadChats();
  }
}
