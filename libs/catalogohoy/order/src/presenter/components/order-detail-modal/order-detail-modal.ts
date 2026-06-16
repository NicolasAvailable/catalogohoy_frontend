import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
} from '@ui';
import { ProfileStore } from '@catalogohoy/profile';
import { InternalNote, Order, OrderStatus } from '../../../domain/order';
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
    IconComponent,
    ImageComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
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

  public readonly order: Order = this.config.data.order;
  public readonly cs: string = this.config.data.currencySymbol ?? '$';
  /** Show the bolivar total line — only for Venezuela-style dual catalogs. */
  public readonly showDualBs: boolean = this.config.data.showDualBs ?? false;
  /** Exchange rate derived from the order snapshot, so per-line Bs amounts
   *  match the order's stored total exactly. 0 when not applicable. */
  public readonly bsRate: number =
    this.order.totalUsd > 0 && this.order.totalBs
      ? this.order.totalBs / this.order.totalUsd
      : 0;

  /** Live status — updated in place when the user changes it from the modal. */
  public readonly status = signal<OrderStatus>(this.order.status);
  public readonly isUpdating = signal(false);

  /** Internal team notes thread (admin-only, chat-style). */
  public readonly notes = signal<InternalNote[]>(this.order.internalNotes ?? []);
  public readonly draft = signal('');
  public readonly isSavingNotes = signal(false);

  /** Top tab: full order detail vs internal team notes. */
  public readonly activeTab = signal<'detalle' | 'notas'>('detalle');

  async addNote(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.isSavingNotes()) return;
    this.isSavingNotes.set(true);
    const note: InternalNote = {
      author: this.profileStore.profile().name?.trim() || 'Equipo',
      text,
      createdAt: new Date().toISOString(),
    };
    const result = await this.orderStore.addInternalNote(this.order.id, note);
    result.fold(
      (error) => this.toastService.error(new Exception(error)),
      () => {
        this.notes.update((n) => [...n, note]);
        this.draft.set('');
      }
    );
    this.isSavingNotes.set(false);
  }

  public readonly statusOptions: { label: string; value: OrderStatus }[] = [
    { label: 'Pendiente', value: 'pending' },
    { label: 'Completada', value: 'completed' },
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
