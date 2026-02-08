import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
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
} from '@ui';
import {
  debounceTime,
  distinctUntilChanged,
  Subject,
  Subscription,
} from 'rxjs';
import { Order, OrderStatus } from '../../../domain/order';
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

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  public readonly searchQuery = signal('');
  public readonly selectedFilter = signal<OrderStatus | 'all'>('all');
  public readonly selectedOrder = signal<OrderBy>('date_desc');
  public readonly selectedDate = signal<Date | null>(null);

  public readonly filterTabs: FilterTab[] = [
    { label: 'Todas', value: 'all' },
    { label: 'Pendientes', value: 'pending' },
    { label: 'Completadas', value: 'completed' },
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

  ngOnInit() {
    // Setup debounced search
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.reloadOrders();
      });

    this.orderStore.loadOrders();
  }

  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
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
    };
    return labels[status] || status;
  }

  getStatusBadgeClass(status: OrderStatus): string {
    const baseClass =
      'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide';
    const colorClasses: Record<OrderStatus, string> = {
      pending: 'bg-orange-100 text-orange-600',
      completed: 'bg-green-100 text-green-600',
    };
    return `${baseClass} ${
      colorClasses[status] || 'bg-grey-100 text-grey-600'
    }`;
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

  onDeleteOrder(order: Order) {
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
            const deleteResult = await this.orderStore.deleteOrder(order.id);
            deleteResult.fold(
              (error) => {
                this.toastService.error(new Exception(error));
              },
              () => {
                this.toastService.success('Orden eliminada correctamente');
              }
            );
          }
        );
      });
  }
}
