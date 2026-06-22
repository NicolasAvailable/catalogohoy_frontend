import {
  Component,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, IconComponent } from '@ui';
import { ChatStore } from '../../../infrastructure/chat.store';

@Component({
  selector: 'lib-conversation-panel',
  standalone: true,
  imports: [FormsModule, IconComponent, ButtonComponent],
  templateUrl: './conversation-panel.html',
})
export class ConversationPanelComponent {
  protected readonly chatStore = inject(ChatStore);
  protected readonly messageInput = signal('');

  private readonly messagesContainer =
    viewChild<ElementRef<HTMLDivElement>>('messagesContainer');

  constructor() {
    effect(() => {
      const msgs = this.chatStore.messages();
      if (msgs.length > 0) {
        setTimeout(() => this.scrollToBottom(), 0);
      }
    });
  }

  private scrollToBottom() {
    const el = this.messagesContainer()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send() {
    const content = this.messageInput().trim();
    if (!content || this.chatStore.isSendingMessage()) return;
    this.chatStore.sendMessage(content);
    this.messageInput.set('');
  }

  /** Quick-reply popover state + insertion. */
  protected readonly quickRepliesOpen = signal(false);

  toggleQuickReplies(): void {
    this.quickRepliesOpen.update((v) => !v);
  }

  insertQuickReply(content: string): void {
    this.messageInput.set(content);
    this.quickRepliesOpen.set(false);
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDayLabel(day: string): string {
    const date = new Date(day + 'T12:00:00');
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
    return date.toLocaleDateString('es', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
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
