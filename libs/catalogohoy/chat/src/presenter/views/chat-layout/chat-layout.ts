import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
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
  styleUrl: './chat-layout.css',
})
export class ChatLayoutComponent implements OnInit, OnDestroy {
  protected readonly chatStore = inject(ChatStore);
  private readonly realtime = inject(ChatRealtimeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private firstSelectionDone = false;

  /** Ficha del cliente como overlay en móvil (botón ⓘ del header del chat). */
  protected readonly mobileFichaOpen = signal(false);

  /** Ficha colapsada en desktop (persistido) — toggle en el header del chat. */
  private static readonly FICHA_COLLAPSED_KEY = 'chat-ficha-collapsed';
  protected readonly fichaDesktopCollapsed = signal(
    localStorage.getItem(ChatLayoutComponent.FICHA_COLLAPSED_KEY) === '1'
  );

  toggleFichaDesktop(): void {
    const next = !this.fichaDesktopCollapsed();
    this.fichaDesktopCollapsed.set(next);
    localStorage.setItem(
      ChatLayoutComponent.FICHA_COLLAPSED_KEY,
      next ? '1' : '0'
    );
  }

  constructor() {
    // Cambiar de conversación (o cerrarla) cierra la ficha móvil.
    effect(() => {
      this.chatStore.selectedChatId();
      this.mobileFichaOpen.set(false);
    });

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
      const query = this.route.snapshot.queryParamMap;
      // Recién conectado Instagram → abrir su conversación más reciente.
      const igConnected = query.get('ig') === 'connected';
      const fbConnected = query.get('fb') === 'connected';
      const wanted = Number(query.get('chat'));
      const target = igConnected
        ? chats.find((c) => c.channel === 'instagram') ?? chats[0]
        : fbConnected
          ? chats.find((c) => c.channel === 'messenger') ?? chats[0]
          : chats.find((c) => c.id === wanted) ?? chats[0];
      this.chatStore.selectChat(target.id);
    });

    // Reflejar el chat abierto en la URL (?chat=ID) para poder compartir el link.
    effect(() => {
      const id = this.chatStore.selectedChatId();
      if (id == null) return;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { chat: id, ig: null, fb: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  reloadApp(): void {
    window.location.reload();
  }

  // ------------------------------------------------- lista redimensionable ---
  /** Ancho de la lista de conversaciones en desktop, ajustable arrastrando el
   *  divisor lista/conversación. Se guarda por navegador (localStorage). */
  private static readonly LIST_WIDTH_KEY = 'chat-list-width';
  private static readonly LIST_MIN_W = 240;
  private static readonly LIST_MAX_W = 480;
  private static readonly LIST_DEFAULT_W = 300;

  protected readonly listWidth = signal(ChatLayoutComponent.storedListWidth());
  protected readonly resizingList = signal(false);
  /** El CSS consume el ancho en rem (regla del proyecto: nunca px en estilos). */
  protected readonly listWidthRem = computed(() => `${this.listWidth() / 16}rem`);

  private static storedListWidth(): number {
    const stored = Number(localStorage.getItem(ChatLayoutComponent.LIST_WIDTH_KEY));
    return ChatLayoutComponent.clampListWidth(stored || ChatLayoutComponent.LIST_DEFAULT_W);
  }

  private static clampListWidth(width: number): number {
    return Math.min(
      ChatLayoutComponent.LIST_MAX_W,
      Math.max(ChatLayoutComponent.LIST_MIN_W, width)
    );
  }

  startListResize(event: PointerEvent): void {
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    this.resizingList.set(true);

    const startX = event.clientX;
    const startWidth = this.listWidth();
    const onMove = (ev: PointerEvent) =>
      this.listWidth.set(
        ChatLayoutComponent.clampListWidth(startWidth + ev.clientX - startX)
      );
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      this.resizingList.set(false);
      localStorage.setItem(
        ChatLayoutComponent.LIST_WIDTH_KEY,
        String(this.listWidth())
      );
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  }

  ngOnInit() {
    // loadChats corre en ConversationsComponent (el gating del empty state
    // necesita los chats antes de montar este layout).
    this.chatStore.loadCrmConfig();
    this.chatStore.loadSavedCustomers(true);
    this.realtime.subscribe();
  }

  ngOnDestroy() {
    this.realtime.unsubscribe();
  }
}
