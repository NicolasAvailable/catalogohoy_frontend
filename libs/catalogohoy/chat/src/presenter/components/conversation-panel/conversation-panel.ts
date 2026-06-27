import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
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
    TooltipModule,
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
  private readonly destroyRef = inject(DestroyRef);
  protected readonly messageInput = signal('');

  /** WhatsApp Cloud API text body limit. */
  protected readonly maxChars = 4096;
  protected readonly overLimit = computed(
    () => this.messageInput().length > this.maxChars
  );

  /** Imágenes adjuntas pendientes de enviar (preview en el composer). Cada una se
   *  envía como un mensaje separado: la Cloud API es 1 archivo por mensaje (igual
   *  que WhatsApp, que agrupa varios mensajes como "álbum"). */
  protected readonly pendingMedia = signal<{ file: File; preview: string }[]>([]);
  protected readonly maxAttachments = 10;

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

  /** Whether the view is pinned to the bottom (so new content auto-scrolls). */
  private stickToBottom = true;
  private listenersAttached = false;

  constructor() {
    this.teamStore.load();

    // New message → scroll to the bottom if we're pinned there.
    effect(() => {
      const msgs = this.chatStore.messages();
      if (msgs.length > 0 && this.stickToBottom) {
        setTimeout(() => this.scrollToBottom(), 0);
      }
    });

    // Attach scroll/load listeners once the container exists. The 'load' (capture)
    // re-scrolls when an image finishes loading — its height isn't known when the
    // message is appended, so a single scroll would stop short of the bottom.
    effect(() => {
      const el = this.messagesContainer()?.nativeElement;
      if (!el || this.listenersAttached) return;
      this.listenersAttached = true;
      el.addEventListener('scroll', this.onScroll, { passive: true });
      el.addEventListener('load', this.onMediaLoad, true);
      this.destroyRef.onDestroy(() => {
        el.removeEventListener('scroll', this.onScroll);
        el.removeEventListener('load', this.onMediaLoad, true);
      });
    });
  }

  private readonly onScroll = (): void => {
    const el = this.messagesContainer()?.nativeElement;
    if (!el) return;
    this.stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  /** When an image finishes loading and we were pinned to the bottom, re-scroll. */
  private readonly onMediaLoad = (): void => {
    if (this.stickToBottom) this.scrollToBottom();
  };

  private scrollToBottom() {
    const el = this.messagesContainer()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send() {
    // Al enviar siempre volvemos al fondo.
    this.stickToBottom = true;
    if (this.chatStore.isSendingMessage() || this.overLimit()) return;
    const media = this.pendingMedia();
    const content = this.messageInput().trim();
    if (media.length) {
      // Cada imagen es un mensaje aparte; el caption (si hay) va en la primera.
      media.forEach((m, i) =>
        this.chatStore.sendMedia(m.file, i === 0 ? content : '')
      );
      this.clearAttachments();
      this.messageInput.set('');
      return;
    }
    if (!content) return;
    this.chatStore.sendMessage(content);
    this.messageInput.set('');
  }

  /** Quita una imagen adjunta (antes de enviar). */
  removeAttachment(index: number): void {
    const list = this.pendingMedia();
    const item = list[index];
    if (item) URL.revokeObjectURL(item.preview);
    this.pendingMedia.set(list.filter((_, i) => i !== index));
  }

  private clearAttachments(): void {
    for (const m of this.pendingMedia()) URL.revokeObjectURL(m.preview);
    this.pendingMedia.set([]);
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

  // ------------------------------------------------------ quoted replies ---

  /** Resolve the message a given message is replying to (from the loaded set). */
  quotedOf(msg: ChatMessage): ChatMessage | undefined {
    if (!msg.replyToMessageId) return undefined;
    return this.chatStore
      .messages()
      .find((m) => m.id === msg.replyToMessageId);
  }

  /** Label for the quoted message's author. */
  quotedAuthor(q: ChatMessage): string {
    return q.isMine
      ? 'Tú'
      : this.chatStore.selectedChat()?.customerName || 'Cliente';
  }

  /** Short preview text for a quoted message. */
  quotedText(q: ChatMessage): string {
    if (q.type === 'image') {
      return q.content && q.content !== '📷 Imagen' ? q.content : '📷 Imagen';
    }
    return q.content;
  }

  /** Start composing a quoted reply to a (persisted) message. */
  startReply(msg: ChatMessage): void {
    if (msg.id <= 0) return;
    this.chatStore.setReplyingTo(msg);
  }

  cancelReply(): void {
    this.chatStore.setReplyingTo(null);
  }

  /** Adjuntar imagen: valida (imagen, ≤5 MB) y la envía vía el store (optimista
   *  → sube a storage → wa-send con type:image). */
  onAttachFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;

    const current = this.pendingMedia();
    const room = this.maxAttachments - current.length;
    if (room <= 0) {
      this.toast.warning(`Máximo ${this.maxAttachments} imágenes.`);
      return;
    }

    const added: { file: File; preview: string }[] = [];
    let skipped = false;
    for (const file of files) {
      if (added.length >= room) {
        skipped = true;
        break;
      }
      if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
        skipped = true;
        continue;
      }
      added.push({ file, preview: URL.createObjectURL(file) });
    }
    if (added.length) this.pendingMedia.set([...current, ...added]);
    if (skipped) {
      this.toast.warning('Algunas imágenes se omitieron (solo JPG/PNG ≤ 5 MB).');
    }
  }
}
