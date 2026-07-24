import { NgClass } from '@angular/common';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';
import { TenantStore } from '@catalogohoy/tenant';
import { WhatsAppService, WhatsAppStore } from '@catalogohoy/whatsapp';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  IconComponent,
  ImageComponent,
} from '@ui';
import { ChatMessage } from '../../../domain';
import { ChatStore } from '../../../infrastructure/chat.store';
import { ChatAudioPlayerComponent } from '../audio-player/audio-player';
import { PhonePlusPipe } from '../phone-plus.pipe';
import { WaFormatPipe } from '../wa-format.pipe';

@Component({
  selector: 'lib-conversation-panel',
  standalone: true,
  imports: [
    FormsModule,
    NgClass,
    RouterLink,
    TooltipModule,
    IconComponent,
    ButtonComponent,
    ImageComponent,
    PickerComponent,
    TranslocoPipe,
    ChatAudioPlayerComponent,
    PhonePlusPipe,
    WaFormatPipe,
  ],
  templateUrl: './conversation-panel.html',
  styleUrl: './conversation-panel.css',
})
export class ConversationPanelComponent {
  protected readonly chatStore = inject(ChatStore);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly messageInput = signal('');

  /** Abrir la ficha del cliente como overlay (solo móvil, botón ⓘ del header). */
  public readonly infoClick = output<void>();

  /** Ficha del cliente visible en desktop (columna derecha) — el header pinta
   *  el toggle activo/inactivo según esto. */
  public readonly fichaVisible = input(true);
  /** Colapsar/expandir la ficha en desktop (botón del header). */
  public readonly toggleFicha = output<void>();

  // -------------------------------------------- canal desvinculado (solo lectura) ---
  private readonly whatsAppStore = inject(WhatsAppStore);
  private readonly whatsAppService = inject(WhatsAppService);
  private readonly tenantStore = inject(TenantStore);

  /** Conexión de IG/TikTok (null = aún no consultado → no bloquear). */
  private readonly igConnected = signal<boolean | null>(null);
  private readonly ttConnected = signal<boolean | null>(null);

  /** Ventana de servicio de WhatsApp (24h) cerrada: el último mensaje ENTRANTE
   *  del cliente fue hace más de 24h (o no hay ninguno). Fuera de esa ventana
   *  Meta rechaza el texto libre y hay que usar una plantilla. Solo aplica a
   *  WhatsApp. */
  protected readonly windowClosed = computed(() => {
    const chat = this.chatStore.selectedChat();
    if (!chat || chat.channel !== 'whatsapp') return false;
    const lastInbound = this.chatStore
      .messages()
      .filter((m) => !m.isMine && !m.isInternal)
      .reduce<string | null>(
        (latest, m) => (!latest || m.createdAt > latest ? m.createdAt : latest),
        null
      );
    if (!lastInbound) return true;
    return Date.now() - new Date(lastInbound).getTime() > 24 * 60 * 60 * 1000;
  });

  /** El canal del chat abierto está desvinculado: se puede leer el historial
   *  pero no responder (el composer se reemplaza por un aviso). */
  protected readonly channelDisconnected = computed(() => {
    const chat = this.chatStore.selectedChat();
    if (!chat) return false;
    if (chat.channel === 'whatsapp') {
      return !this.whatsAppStore.isLoading() && !this.whatsAppStore.hasActiveAccount();
    }
    if (chat.channel === 'instagram') return this.igConnected() === false;
    if (chat.channel === 'tiktok') return this.ttConnected() === false;
    return false;
  });

  /** WhatsApp Cloud API text body limit. */
  protected readonly maxChars = 4096;
  protected readonly overLimit = computed(
    () => this.messageInput().length > this.maxChars
  );

  /** Composer mode: 'message' (al cliente) o 'whisper' (nota interna del equipo). */
  protected readonly composerMode = signal<'message' | 'whisper'>('message');

  setComposerMode(mode: 'message' | 'whisper'): void {
    this.composerMode.set(mode);
  }

  /** Adjuntos pendientes de enviar (imágenes o documentos), cada uno con su
   *  caption (estilo WhatsApp Web). Cada uno se manda como un mensaje separado:
   *  la Cloud API es 1 archivo por mensaje. */
  protected readonly pendingMedia = signal<
    {
      file: File;
      preview: string;
      caption: string;
      kind: 'image' | 'document';
      name: string;
    }[]
  >([]);
  protected readonly maxAttachments = 10;
  /** Overlay "soltá el archivo" mientras se arrastra algo sobre el composer. */
  protected readonly isDraggingFile = signal(false);
  private readonly maxImageBytes = 5 * 1024 * 1024;
  private readonly maxDocBytes = 25 * 1024 * 1024;
  /** Imagen mostrada en grande en el overlay de preview. */
  protected readonly activeIndex = signal(0);
  protected readonly activeItem = computed(
    () => this.pendingMedia()[this.activeIndex()] ?? null
  );

  private readonly messagesContainer =
    viewChild<ElementRef<HTMLDivElement>>('messagesContainer');

  /** Whether the view is pinned to the bottom (so new content auto-scrolls). */
  private stickToBottom = true;
  private listenersAttached = false;

  constructor() {
    // Estado de conexión de IG/TikTok (una consulta) para el modo solo lectura.
    this.tenantStore.getTenantIdAsync().then(async (tenantId) => {
      if (!tenantId) return;
      const [ig, tt] = await Promise.all([
        this.whatsAppService.getInstagramAccount(tenantId),
        this.whatsAppService.getTikTokAccount(tenantId),
      ]);
      if (ig.isRight()) this.igConnected.set(ig.value !== null);
      if (tt.isRight()) this.ttConnected.set(tt.value !== null);
    });

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
    // Canal desvinculado → conversación en solo lectura.
    if (this.channelDisconnected()) return;
    // Al enviar siempre volvemos al fondo.
    this.stickToBottom = true;
    if (this.chatStore.isSendingMessage() || this.overLimit()) return;

    // Susurro: nota interna del equipo (solo texto, no se envía al cliente).
    if (this.composerMode() === 'whisper') {
      const note = this.messageInput().trim();
      if (!note) return;
      this.chatStore.sendInternalNote(note);
      this.messageInput.set('');
      return;
    }

    const media = this.pendingMedia();
    if (media.length) {
      // Cada imagen es un mensaje aparte, con su propio caption.
      media.forEach((m) => this.chatStore.sendMedia(m.file, m.caption.trim()));
      this.clearAttachments();
      return;
    }
    const content = this.messageInput().trim();
    if (!content) return;
    this.chatStore.sendMessage(content);
    this.messageInput.set('');
  }

  /** Caption de la imagen activa en el overlay. */
  setActiveCaption(text: string): void {
    const idx = this.activeIndex();
    this.pendingMedia.update((list) =>
      list.map((m, i) => (i === idx ? { ...m, caption: text } : m))
    );
  }

  /** Descarga la imagen activa del overlay (es un object URL local). */
  downloadActive(): void {
    const item = this.activeItem();
    if (!item) return;
    const link = document.createElement('a');
    link.href = item.preview;
    link.download = item.file.name || 'imagen';
    link.click();
  }

  /** Quita la imagen activa del overlay. */
  removeActive(): void {
    const idx = this.activeIndex();
    const item = this.pendingMedia()[idx];
    if (item) URL.revokeObjectURL(item.preview);
    this.pendingMedia.update((list) => list.filter((_, i) => i !== idx));
    const len = this.pendingMedia().length;
    if (idx >= len) this.activeIndex.set(Math.max(0, len - 1));
  }

  /** Descarta todos los adjuntos (cerrar el overlay sin enviar). */
  closePreview(): void {
    this.clearAttachments();
  }

  private clearAttachments(): void {
    for (const m of this.pendingMedia()) URL.revokeObjectURL(m.preview);
    this.pendingMedia.set([]);
    this.activeIndex.set(0);
  }

  /** Quick-reply popover state + insertion. */
  protected readonly quickRepliesOpen = signal(false);

  /** Formulario de crear/editar respuesta rápida (null = viendo la lista). */
  protected readonly qrForm = signal<{
    id: number | null;
    shortcut: string;
    content: string;
  } | null>(null);
  protected readonly qrSaving = signal(false);

  startNewQuickReply(): void {
    this.qrForm.set({ id: null, shortcut: '', content: '' });
  }

  editQuickReply(qr: { id: number; shortcut: string; content: string }, event: Event): void {
    event.stopPropagation();
    this.qrForm.set({ id: qr.id, shortcut: qr.shortcut, content: qr.content });
  }

  setQrField(field: 'shortcut' | 'content', value: string): void {
    const form = this.qrForm();
    if (form) this.qrForm.set({ ...form, [field]: value });
  }

  async saveQuickReply(): Promise<void> {
    const form = this.qrForm();
    if (!form || !form.shortcut.trim() || !form.content.trim() || this.qrSaving()) {
      return;
    }
    this.qrSaving.set(true);
    const ok = await this.chatStore.saveQuickReply(form);
    this.qrSaving.set(false);
    if (ok) this.qrForm.set(null);
  }

  removeQuickReply(id: number, event: Event): void {
    event.stopPropagation();
    this.chatStore.deleteQuickReply(id);
  }

  toggleQuickReplies(event: Event): void {
    event.stopPropagation();
    this.emojiPickerOpen.set(false);
    this.qrForm.set(null);
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

  /** Adjuntar desde el selector de archivos (imágenes o documentos). */
  onAttachFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.addFiles(files);
  }

  /** Adjuntar archivos soltados desde el escritorio (drag & drop). */
  onDropFiles(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFile.set(false);
    if (this.composerMode() === 'whisper') return;
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  onDragOverComposer(event: DragEvent): void {
    if (this.composerMode() === 'whisper') return;
    event.preventDefault();
    this.isDraggingFile.set(true);
  }

  onDragLeaveComposer(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFile.set(false);
  }

  /** Valida y agrega adjuntos: imágenes (≤5 MB) o documentos (≤25 MB). El tipo
   *  real (image/document) lo resuelve el store al enviar según el mime. */
  private addFiles(files: File[]): void {
    if (!files.length) return;
    const current = this.pendingMedia();
    const room = this.maxAttachments - current.length;
    if (room <= 0) {
      this.toast.warning(`Máximo ${this.maxAttachments} archivos.`);
      return;
    }

    const added: {
      file: File;
      preview: string;
      caption: string;
      kind: 'image' | 'document';
      name: string;
    }[] = [];
    let skipped = false;
    for (const file of files) {
      if (added.length >= room) {
        skipped = true;
        break;
      }
      const isImage = file.type.startsWith('image/');
      // Video/audio no se envían desde el composer (WhatsApp usa otro tipo).
      const isAvMedia =
        file.type.startsWith('video/') || file.type.startsWith('audio/');
      const limit = isImage ? this.maxImageBytes : this.maxDocBytes;
      if (isAvMedia || file.size > limit) {
        skipped = true;
        continue;
      }
      added.push({
        file,
        preview: URL.createObjectURL(file),
        caption: '',
        kind: isImage ? 'image' : 'document',
        name: file.name,
      });
    }
    if (added.length) {
      const wasEmpty = current.length === 0;
      this.pendingMedia.set([...current, ...added]);
      if (wasEmpty) this.activeIndex.set(0);
    }
    if (skipped) {
      this.toast.warning(
        'Algunos archivos se omitieron (imágenes ≤ 5 MB o documentos ≤ 25 MB).'
      );
    }
  }

  /** Icono + etiqueta + colores de un documento según su extensión (nombre o
   *  URL de storage). Se usa en el preview del composer y en las burbujas. */
  protected docMeta(nameOrUrl: string | null | undefined): {
    icon: string;
    label: string;
    color: string;
    bg: string;
  } {
    // Sirve tanto para nombres reales (productos.xlsx) como para URLs de
    // storage donde el "tail" es el mime de WhatsApp (…spreadsheetml.sheet).
    const clean = (nameOrUrl ?? '').toLowerCase().split('?')[0].split('#')[0];
    const ext = clean.includes('.') ? clean.split('.').pop()! : '';
    const has = (s: string) => clean.includes(s);
    if (['xlsx', 'xls', 'xlsm', 'ods', 'sheet'].includes(ext) || has('spreadsheetml') || has('ms-excel'))
      return { icon: 'file-spreadsheet', label: 'Excel', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (ext === 'csv')
      return { icon: 'file-spreadsheet', label: 'CSV', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (ext === 'pdf' || has('/pdf'))
      return { icon: 'file-text', label: 'PDF', color: 'text-red-600', bg: 'bg-red-50' };
    if (['doc', 'docx', 'odt', 'rtf'].includes(ext) || has('wordprocessingml') || has('msword'))
      return { icon: 'file-text', label: 'Word', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (['ppt', 'pptx', 'odp'].includes(ext) || has('presentationml') || has('powerpoint'))
      return { icon: 'file-text', label: 'PowerPoint', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { icon: 'file-text', label: 'Documento', color: 'text-grey-500', bg: 'bg-grey-100' };
  }

  /** Tamaño legible (KB/MB) para el preview de documentos. */
  protected formatBytes(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
