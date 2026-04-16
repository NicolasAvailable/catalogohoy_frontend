import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { EcommerceConfigStore, TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  ConfirmDialogService,
  DatepickerComponent,
  EmptyListComponent,
  IconComponent,
  InputSearchComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
  TooltipDirective,
} from '@ui';
import {
  debounceTime,
  distinctUntilChanged,
  Subject,
  Subscription,
} from 'rxjs';
import { Order, OrderStatus } from '../../../domain/order';
import { OrderPdfService } from '../../../infrastructure/order-pdf.service';
import { OrderRealtimeService } from '../../../infrastructure/order-realtime.service';
import { OrderStore } from '../../../infrastructure/order.store';

type FilterTab = { label: string; value: OrderStatus | 'all' };
type OrderBy = 'date_asc' | 'date_desc' | 'total_asc' | 'total_desc';

@Component({
  selector: 'lib-order-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonComponent,
    DatepickerComponent,
    EmptyListComponent,
    InputSearchComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
    TooltipDirective,
  ],
  templateUrl: './order-list.html',
  styleUrl: './order-list.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export class OrderListComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);
  public readonly orderStore = inject(OrderStore);
  private readonly configStore = inject(EcommerceConfigStore);
  public readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly orderPdf = inject(OrderPdfService);
  // Prefer the cached tenant currency symbol (from localStorage / DB).
  // Falls back to the editor config only if the cache hasn't been
  // primed yet (e.g., user opens orders before visiting home).
  //
  // Venezuela exception: order totals are tracked in USD (dual with Bs.
  // in the next column), so the "Total" column shows '$' even though
  // the tenant's local symbol would be 'Bs.'.
  public readonly cs = computed(() => {
    if (this.tenantCurrency.isVenezuela()) return '$';
    return (
      this.tenantCurrency.localSymbol() ||
      this.configStore.config()?.currencySymbol ||
      '$'
    );
  });
  private readonly orderRealtime = inject(OrderRealtimeService);
  private readonly permissions = inject(TeamPermissionsStore);
  protected readonly canCreateOrder = computed(() => this.permissions.isOwner() || this.permissions.can()('ordenes', 'create'));
  protected readonly canEditOrder = computed(() => this.permissions.isOwner() || this.permissions.can()('ordenes', 'edit'));
  protected readonly canDeleteOrder = computed(() => this.permissions.isOwner() || this.permissions.can()('ordenes', 'delete'));

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  public readonly searchQuery = signal('');
  public readonly selectedFilter = signal<OrderStatus | 'all'>('all');
  public readonly selectedOrder = signal<OrderBy>('date_desc');
  public readonly selectedDate = signal<Date | null>(null);
  public readonly expandedOrderId = signal<number | null>(null);
  public readonly isProcessing = signal(false);
  public readonly mobileShowAll = signal(false);

  public readonly filterTabs: FilterTab[] = [
    { label: 'Todas', value: 'all' },
    { label: 'Pendientes', value: 'pending' },
    { label: 'Completadas', value: 'completed' },
    { label: 'Canceladas', value: 'cancelled' },
  ];

  public readonly statusOptions: {
    label: string;
    value: OrderStatus;
  }[] = [
    { label: 'Pendiente', value: 'pending' },
    { label: 'Completada', value: 'completed' },
    { label: 'Cancelada', value: 'cancelled' },
  ];

  public readonly orderOptions: {
    label: string;
    value: OrderBy;
    icon: string;
  }[] = [
    { label: 'Más nuevas', value: 'date_desc', icon: 'arrow-down' },
    { label: 'Más viejas', value: 'date_asc', icon: 'arrow-up' },
    { label: 'Total más alto', value: 'total_desc', icon: 'trending-up' },
    { label: 'Total más bajo', value: 'total_asc', icon: 'trending-down' },
  ];

  public readonly filteredOrders = computed(() => {
    let orders = [...this.orderStore.orderList().items];

    // Filter by status
    const filter = this.selectedFilter();
    if (filter !== 'all') {
      orders = orders.filter((order) => order.status === filter);
    }

    // Search is now handled by Supabase query

    // Sort by selected order
    const orderBy = this.selectedOrder();
    switch (orderBy) {
      case 'date_desc':
        orders.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'date_asc':
        orders.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case 'total_desc':
        orders.sort((a, b) => b.totalUsd - a.totalUsd);
        break;
      case 'total_asc':
        orders.sort((a, b) => a.totalUsd - b.totalUsd);
        break;
    }

    return orders;
  });

  public readonly mobileOrders = computed(() => {
    const orders = this.filteredOrders();
    return this.mobileShowAll() ? orders : orders.slice(0, 5);
  });

  async ngOnInit() {
    // Prime the tenant currency cache (localStorage → DB fallback).
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (tenantId) this.tenantCurrency.load(tenantId);

    // Setup debounced search
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.reloadOrders();
      });

    this.orderStore.loadOrders();
    this.orderRealtime.subscribe();
  }

  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
    this.orderRealtime.unsubscribe();
  }

  toggleExpand(orderId: number) {
    this.expandedOrderId.set(
      this.expandedOrderId() === orderId ? null : orderId
    );
  }

  onCreateOrder() {
    this.router.navigate(['/admin/orders/create']);
  }

  onEditOrder(order: Order) {
    this.router.navigate(['/admin/orders/edit', order.id]);
  }

  selectFilter(filter: OrderStatus | 'all') {
    this.selectedFilter.set(filter);
  }

  setOrder(order: OrderBy) {
    this.selectedOrder.set(order);
  }

  reloadOrders() {
    const date = this.selectedDate() ?? undefined;
    const search = this.searchQuery() || undefined;
    this.orderStore.loadOrders({ date, search });
  }

  onDateChange(date: Date | null) {
    this.selectedDate.set(date);
    this.reloadOrders();
  }

  onSearch(query: string) {
    this.searchSubject.next(query);
  }

  getStatusSeverity(
    status: string
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warn';
      default:
        return 'secondary';
    }
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      pending: 'Pendiente',
      completed: 'Completada',
      cancelled: 'Cancelada',
    };
    return labels[status] || status;
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

  getPaymentMethod(order: Order): string {
    // This could be expanded based on actual payment data
    const methods = ['WhatsApp', 'Efectivo', 'Zelle', 'Pago Móvil'];
    return methods[order.id % methods.length];
  }

  getPaymentIcon(order: Order): string {
    const method = this.getPaymentMethod(order);
    const icons: Record<string, string> = {
      WhatsApp: 'message-circle',
      Efectivo: 'banknote',
      Zelle: 'wallet',
      'Pago Móvil': 'smartphone',
    };
    return icons[method] || 'credit-card';
  }

  getPaymentColor(order: Order): string {
    const method = this.getPaymentMethod(order);
    const colors: Record<string, string> = {
      WhatsApp: 'text-green-500',
      Efectivo: 'text-blue-500',
      Zelle: 'text-emerald-500',
      'Pago Móvil': 'text-purple-500',
    };
    return colors[method] || 'text-grey-500';
  }

  getTodaySales(): number {
    const today = new Date().toDateString();
    return this.orderStore
      .orderList()
      .items.filter(
        (order) => new Date(order.createdAt).toDateString() === today
      )
      .reduce((sum, order) => sum + order.totalUsd, 0);
  }

  getPendingCount(): number {
    return this.orderStore
      .orderList()
      .items.filter((order) => order.status === 'pending').length;
  }

  getCompletedCount(): number {
    return this.orderStore
      .orderList()
      .items.filter((order) => order.status === 'completed').length;
  }

  getWhatsAppLink(phone: string): string {
    // Remove all non-numeric characters except +
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    return `https://wa.me/${cleanPhone}`;
  }

  getCancelledCount(): number {
    return this.orderStore
      .orderList()
      .items.filter((order) => order.status === 'cancelled').length;
  }

  async onStatusChange(order: Order, newStatus: OrderStatus) {
    if (newStatus === order.status || this.isProcessing()) return;

    this.isProcessing.set(true);
    const result = await this.orderStore.updateOrderStatus(
      order.id,
      order.status,
      newStatus
    );
    result.fold(
      (error) => this.toastService.error(new Exception(error)),
      () => {
        const label = this.getStatusLabel(newStatus);
        this.toastService.success(`Estado actualizado a "${label}"`);
      }
    );
    this.isProcessing.set(false);
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
    return labels[method] || method;
  }

  onDeleteOrder(order: Order) {
    if (this.isProcessing()) return;

    this.confirmDialogService
      .warning({
        headerLabel: '¿Eliminar orden?',
        contentLabel: `¿Estás seguro de que deseas eliminar la orden de "${order.name}"? Esta acción no se puede deshacer.`,
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
      })
      .subscribe((result) => {
        result.fold(
          () => {
            // Usuario canceló
          },
          async () => {
            // Usuario confirmó
            this.isProcessing.set(true);
            const deleteResult = await this.orderStore.deleteOrder(order.id);
            deleteResult.fold(
              (error) => {
                this.toastService.error(new Exception(error));
              },
              () => {
                this.toastService.success('Orden eliminada correctamente');
              }
            );
            this.isProcessing.set(false);
          }
        );
      });
  }

  downloadPdf(order: Order): void {
    this.orderPdf.download(order);
  }
}
