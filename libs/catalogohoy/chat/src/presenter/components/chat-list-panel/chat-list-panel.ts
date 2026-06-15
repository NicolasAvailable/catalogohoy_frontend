import { Component, inject } from '@angular/core';
import { ProfileStore } from '@catalogohoy/profile';
import {
  AvatarComponent,
  IconComponent,
  InputSearchComponent,
} from '@ui';
import { ChatStore } from '../../../infrastructure/chat.store';

@Component({
  selector: 'lib-chat-list-panel',
  standalone: true,
  imports: [AvatarComponent, IconComponent, InputSearchComponent],
  templateUrl: './chat-list-panel.html',
})
export class ChatListPanelComponent {
  protected readonly chatStore = inject(ChatStore);
  protected readonly profileStore = inject(ProfileStore);

  onSearch(query: string) {
    this.chatStore.setSearchQuery(query);
    this.chatStore.loadChats();
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('es', { weekday: 'short' });
    }
    return date.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
  }

  initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
}
