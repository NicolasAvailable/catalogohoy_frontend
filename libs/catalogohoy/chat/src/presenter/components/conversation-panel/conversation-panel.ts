import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TeamStore } from '@catalogohoy/teams';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  IconComponent,
  ImageComponent,
  SelectComponent,
} from '@ui';
import { ChatMessage } from '../../../domain';
import { ChatStore } from '../../../infrastructure/chat.store';

@Component({
  selector: 'lib-conversation-panel',
  standalone: true,
  imports: [
    FormsModule,
    IconComponent,
    ButtonComponent,
    ImageComponent,
    SelectComponent,
    PickerComponent,
  ],
  templateUrl: './conversation-panel.html',
})
export class ConversationPanelComponent {
  protected readonly chatStore = inject(ChatStore);
  protected readonly teamStore = inject(TeamStore);
  private readonly toast = inject(ToastService);
  protected readonly messageInput = signal('');

  /** WhatsApp Cloud API text body limit. */
  protected readonly maxChars = 4096;
  protected readonly overLimit = computed(
    () => this.messageInput().length > this.maxChars
  );

  /** Imagen adjunta pendiente de enviar (preview en el composer). */
  protected readonly pendingFile = signal<File | null>(null);
  protected readonly pendingPreview = signal<string | null>(null);

  /** Team members for the header "Asignar a" control (mirrors the ficha). */
  protected readonly assigneeOptions = computed(() => [
    { label: 'Sin asignar', value: null as number | null },
    ...this.teamStore
      .acceptedMembers()
      .filter((m) => m.userId !== null)
      .map((m) => ({
        label:
          `${m.userName ?? ''} ${m.userLastName ?? ''}`.trim() ||
          m.invitedEmail,
        value: m.userId,
      })),
  ]);

  private readonly messagesContainer =
    viewChild<ElementRef<HTMLDivElement>>('messagesContainer');

  onAssign(userId: number | null): void {
    const c = this.chatStore.selectedChat();
    if (c) this.chatStore.assignChat(c.id, userId);
  }

  constructor() {
    this.teamStore.load();

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
    if (this.chatStore.isSendingMessage() || this.overLimit()) return;
    const file = this.pendingFile();
    const content = this.messageInput().trim();
    if (file) {
      // Envía la imagen adjunta con el texto como caption.
      this.chatStore.sendMedia(file, content);
      this.clearAttachment();
      this.messageInput.set('');
      return;
    }
    if (!content) return;
    this.chatStore.sendMessage(content);
    this.messageInput.set('');
  }

  /** Descarta la imagen adjunta antes de enviarla. */
  clearAttachment(): void {
    const url = this.pendingPreview();
    if (url) URL.revokeObjectURL(url);
    this.pendingFile.set(null);
    this.pendingPreview.set(null);
  }

  /** Quick-reply popover state + insertion. */
  protected readonly quickRepliesOpen = signal(false);

  toggleQuickReplies(event: Event): void {
    event.stopPropagation();
    this.emojiPickerOpen.set(false);
    this.quickRepliesOpen.update((v) => !v);
  }

  insertQuickReply(content: string): void {
    this.messageInput.set(content);
    this.quickRepliesOpen.set(false);
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('es', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  /** WhatsApp-style grouping: a message starts a new group when the previous one
   *  is from a different sender or >3 min earlier; it ends a group when the next
   *  one differs likewise. Only group-end bubbles show the time. */
  private gapMin(a: string, b: string): number {
    return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60000;
  }

  isGroupStart(msgs: ChatMessage[], i: number): boolean {
    if (i === 0) return true;
    const prev = msgs[i - 1];
    const cur = msgs[i];
    return (
      prev.isMine !== cur.isMine || this.gapMin(prev.createdAt, cur.createdAt) > 3
    );
  }

  isGroupEnd(msgs: ChatMessage[], i: number): boolean {
    if (i === msgs.length - 1) return true;
    const next = msgs[i + 1];
    const cur = msgs[i];
    return (
      next.isMine !== cur.isMine || this.gapMin(cur.createdAt, next.createdAt) > 3
    );
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

  /** Emoji picker (Apple set) state + insertion. */
  protected readonly emojiPickerOpen = signal(false);

  toggleEmojiPicker(event: Event): void {
    event.stopPropagation();
    this.emojiPickerOpen.update((v) => !v);
  }

  /** Append the selected emoji to the message draft (keeps the picker open so
   *  the user can add several). */
  addEmoji(event: { emoji: { native: string } }): void {
    this.messageInput.update((v) => v + (event.emoji?.native ?? ''));
  }

  /** Close each popover when the click lands outside *its own* wrapper (not just
   *  outside the whole panel) so clicking the messages/area also dismisses it. */
  @HostListener('document:click', ['$event'])
  closePopovers(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.emojiPickerOpen() && !target.closest('.emoji-popover-wrap')) {
      this.emojiPickerOpen.set(false);
    }
    if (this.quickRepliesOpen() && !target.closest('.qr-popover-wrap')) {
      this.quickRepliesOpen.set(false);
    }
  }

  /** Adjuntar imagen: valida (imagen, ≤5 MB) y la envía vía el store (optimista
   *  → sube a storage → wa-send con type:image). */
  onAttachFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.warning('Por ahora solo se pueden enviar imágenes (JPG/PNG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.warning('La imagen supera el máximo de 5 MB.');
      return;
    }
    // Adjuntar (preview); se envía al pulsar "Enviar".
    this.clearAttachment();
    this.pendingFile.set(file);
    this.pendingPreview.set(URL.createObjectURL(file));
  }
}
