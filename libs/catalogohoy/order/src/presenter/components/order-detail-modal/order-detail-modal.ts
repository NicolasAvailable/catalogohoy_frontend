import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  NgZone,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import {
  DynamicDialogConfig,
  DynamicDialogRef,
  IconComponent,
  ImageComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
  UploaderComponent,
} from '@ui';
import { ProfileStore } from '@catalogohoy/profile';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { RateStore } from '@catalogohoy/rate';
import {
  effectiveOrderBs,
  InternalNote,
  Order,
  OrderStatus,
} from '../../../domain/order';
import { OrderStore } from '../../../infrastructure/order.store';

/** Modal de detalle de una orden. Se abre vía DialogService desde el listado
 *  (botón "ojo") y desde el deep-link `?order=ID` (botón "Ver pedido" de las
 *  notificaciones WhatsApp). Permite actualizar el estado de la orden. */
@Component({
  selector: 'lib-order-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoPipe,
    IconComponent,
    ImageComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
    UploaderComponent,
  ],
  templateUrl: './order-detail-modal.html',
  styleUrl: './order-detail-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailModal {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig);
  private readonly orderStore = inject(OrderStore);
  private readonly toastService = inject(ToastService);
  private readonly profileStore = inject(ProfileStore);
  private readonly supabase = SupabaseClientProvider.getInstance();
  private readonly zone = inject(NgZone);

  public readonly order: Order = this.config.data.order;
  public readonly cs: string = this.config.data.currencySymbol ?? '$';
  /** Show the bolivar total line — only for Venezuela-style dual catalogs. */
  public readonly showDualBs: boolean = this.config.data.showDualBs ?? false;
  private readonly rateStore = inject(RateStore);

  /** Bs efectivo de la orden: los PENDIENTES a la tasa ACTUAL del catálogo, el
   *  resto su snapshot histórico. Ver {@link effectiveOrderBs}. */
  public readonly effectiveBs = computed(() =>
    effectiveOrderBs(this.order, this.rateStore.rateValue())
  );

  /** Tasa usada para el Bs por línea, coherente con {@link effectiveBs}:
   *  la tasa actual en pendientes, o la del snapshot en el resto. */
  public readonly bsRate = computed(() =>
    this.order.totalUsd > 0 ? this.effectiveBs() / this.order.totalUsd : 0
  );

  /** Live status — updated in place when the user changes it from the modal. */
  public readonly status = signal<OrderStatus>(this.order.status);
  public readonly isUpdating = signal(false);

  /** Internal team notes thread (admin-only, chat-style). */
  public readonly notes = signal<InternalNote[]>(this.order.internalNotes ?? []);
  public readonly draft = signal('');
  public readonly isSavingNotes = signal(false);
  /** Media (image/video URLs) already uploaded, waiting to be sent with a note. */
  public readonly pendingMedia = signal<string[]>([]);
  /** True while a chat attachment is uploading. */
  public readonly isUploadingMedia = signal(false);

  public readonly canSend = computed(
    () => !!this.draft().trim() || this.pendingMedia().length > 0
  );

  private readonly currentUserName = computed(
    () => this.profileStore.profile().name?.trim() || 'Equipo'
  );

  /** Active section.
   *  - Desktop: products are always shown on the left; the right panel toggles
   *    between 'cliente' (Detalle) and 'notas'.
   *  - Mobile: a single column with three tabs — 'info' (products), 'cliente'
   *    and 'notas'. */
  public readonly tab = signal<'info' | 'cliente' | 'notas'>('info');

  /** True on lg+ screens, kept in sync with a matchMedia listener. */
  public readonly isDesktop = signal(
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : true
  );

  /** Products are always visible on desktop; on mobile only under the Info tab. */
  public readonly showProducts = computed(
    () => this.isDesktop() || this.tab() === 'info'
  );
  /** Customer panel: desktop shows it unless the Notas tab is active. */
  public readonly showCliente = computed(() =>
    this.isDesktop() ? this.tab() !== 'notas' : this.tab() === 'cliente'
  );
  public readonly showNotas = computed(() => this.tab() === 'notas');

  constructor() {
    const destroyRef = inject(DestroyRef);

    if (typeof window !== 'undefined') {
      const mql = window.matchMedia('(min-width: 1024px)');
      const handler = (e: MediaQueryListEvent) => this.isDesktop.set(e.matches);
      mql.addEventListener('change', handler);
      destroyRef.onDestroy(() => mql.removeEventListener('change', handler));
    }

    // Realtime: reflect notes other team members add to this order instantly.
    const channel = this.supabase
      .channel(`order-notes-${this.order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${this.order.id}`,
        },
        (payload) => {
          const next = (payload.new as { internal_notes?: InternalNote[] })
            ?.internal_notes;
          if (Array.isArray(next)) {
            this.zone.run(() => this.notes.set(next));
          }
        }
      )
      .subscribe();
    destroyRef.onDestroy(() => {
      this.supabase.removeChannel(channel);
    });
  }

  /** First letter of the author's name, for the fallback avatar. */
  initial(name: string | null | undefined): string {
    return (name?.trim()?.charAt(0) || '?').toUpperCase();
  }

  /** A note authored by the logged-in user — rendered on the right. */
  isMine(note: InternalNote): boolean {
    return note.author?.trim() === this.currentUserName();
  }

  /** Rough media-type check by extension, to pick <img> vs <video>. */
  isVideo(url: string): boolean {
    return /\.(mp4|webm|mov|ogg|m4v)(\?|$)/i.test(url);
  }

  onMediaUploaded(value: string | string[]): void {
    const urls = Array.isArray(value) ? value : [value];
    this.pendingMedia.update((m) => [...m, ...urls.filter(Boolean)]);
    this.isUploadingMedia.set(false);
  }

  removePendingMedia(url: string): void {
    this.pendingMedia.update((m) => m.filter((u) => u !== url));
  }

  async addNote(): Promise<void> {
    const text = this.draft().trim();
    const media = this.pendingMedia();
    if ((!text && media.length === 0) || this.isSavingNotes()) return;

    const note: InternalNote = {
      author: this.currentUserName(),
      authorPhoto: this.profileStore.profile().photo ?? null,
      text,
      createdAt: new Date().toISOString(),
      ...(media.length ? { media } : {}),
    };

    // Optimistic: show the note immediately and clear the composer, so it feels
    // instant. Persisting + realtime reconciliation happen in the background.
    this.notes.update((n) => [...n, note]);
    this.draft.set('');
    this.pendingMedia.set([]);
    this.isSavingNotes.set(true);

    const result = await this.orderStore.addInternalNote(this.order.id, note);
    result.fold(
      (error) => {
        // Roll back the optimistic note and restore the draft on failure.
        this.notes.update((n) => n.filter((x) => x !== note));
        this.draft.set(text);
        this.pendingMedia.set(media);
        this.toastService.error(new Exception(error));
      },
      () => undefined
    );
    this.isSavingNotes.set(false);
  }

  public readonly statusOptions: { label: string; value: OrderStatus }[] = [
    { label: 'Pendiente', value: 'pending' },
    { label: 'Completada', value: 'completed' },
    { label: 'A crédito', value: 'credit' },
    { label: 'Cancelada', value: 'cancelled' },
  ];

  async onStatusChange(newStatus: OrderStatus): Promise<void> {
    const current = this.status();
    if (newStatus === current || this.isUpdating()) return;

    this.isUpdating.set(true);
    const result = await this.orderStore.updateOrderStatus(
      this.order.id,
      current,
      newStatus
    );
    result.fold(
      (error) => this.toastService.error(new Exception(error)),
      () => {
        this.status.set(newStatus);
        this.toastService.success(
          `Estado actualizado a "${this.getStatusLabel(newStatus)}"`
        );
      }
    );
    this.isUpdating.set(false);
  }

  close(): void {
    this.ref.close();
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      pending: 'Pendiente',
      completed: 'Completada',
      credit: 'A crédito',
      cancelled: 'Cancelada',
    };
    return labels[status] ?? status;
  }

  getStatusBadgeClass(_status: OrderStatus): string {
    return 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-grey-100 text-grey-700';
  }

  getStatusDotClass(status: OrderStatus): string {
    const colors: Record<OrderStatus, string> = {
      pending: 'bg-orange-400',
      completed: 'bg-green-500',
      credit: 'bg-blue-500',
      cancelled: 'bg-red-500',
    };
    return `w-2 h-2 rounded-full shrink-0 ${colors[status] ?? 'bg-grey-400'}`;
  }

  getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      tarjeta_credito: 'Tarjeta de crédito',
      pago_movil: 'Pago móvil',
      binance: 'Binance',
      zelle: 'Zelle',
      paypal: 'PayPal',
    };
    return labels[method] ?? method;
  }

  getWhatsAppLink(phone: string): string {
    return `https://wa.me/${phone.replace(/[^\d+]/g, '')}`;
  }
}
