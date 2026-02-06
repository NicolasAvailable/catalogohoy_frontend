import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent,
  EmptyListComponent,
  IconComponent,
  InputSearchComponent,
  MenuComponent,
  MenuItem,
} from '@ui';
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
    EmptyListComponent,
    InputSearchComponent,
    MenuComponent,
  ],
  templateUrl: './order-list.html',
  styleUrl: './order-list.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export class OrderListComponent implements OnInit {
  public readonly orderStore = inject(OrderStore);

  public searchQuery = '';
  public readonly selectedFilter = signal<OrderStatus | 'all'>('all');
  public readonly selectedOrder = signal<OrderBy>('date_desc');
  public readonly orderMenu = viewChild.required<MenuComponent>('orderMenu');

  public readonly filterTabs: FilterTab[] = [
    { label: 'Todas', value: 'all' },
    { label: 'Pendientes', value: 'pending' },
    { label: 'Confirmadas', value: 'confirmed' },
    { label: 'Enviadas', value: 'shipped' },
    { label: 'Entregadas', value: 'delivered' },
  ];

  public readonly orderMenuItems = computed<MenuItem[]>(() => [
    {
      label: 'Más nuevas',
      command: () => this.setOrder('date_desc'),
      styleClass: 'text-sm text-grey-300! font-bold',
    },
    {
      label: 'Más viejas',
      command: () => this.setOrder('date_asc'),
      styleClass: 'text-sm text-grey-300! font-bold',
    },
    {
      label: 'Total más alto',
      command: () => this.setOrder('total_desc'),
      styleClass: 'text-sm text-grey-300! font-bold',
    },
    {
      label: 'Total más bajo',
      command: () => this.setOrder('total_asc'),
      styleClass: 'text-sm text-grey-300! font-bold',
    },
  ]);

  public readonly filteredOrders = computed(() => {
    let orders = [...this.orderStore.orderList().items];

    // Filter by status
    const filter = this.selectedFilter();
    if (filter !== 'all') {
      orders = orders.filter((order) => order.status === filter);
    }

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      orders = orders.filter(
        (order) =>
          order.id.toString().includes(query) ||
          order.name.toLowerCase().includes(query) ||
          order.products.some((p) => p.name.toLowerCase().includes(query))
      );
    }

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
    this.orderStore.loadOrders();
  }

  onCreateOrder() {
    // TODO: Implement create order navigation
  }

  selectFilter(filter: OrderStatus | 'all') {
    this.selectedFilter.set(filter);
  }

  toggleOrderMenu(event: Event) {
    this.orderMenu().toggle(event);
  }

  setOrder(order: OrderBy) {
    this.selectedOrder.set(order);
  }

  getOrderLabel(): string {
    const order = this.selectedOrder();
    switch (order) {
      case 'date_desc':
        return 'Más nuevas';
      case 'date_asc':
        return 'Más viejas';
      case 'total_desc':
        return 'Total más alto';
      case 'total_asc':
        return 'Total más bajo';
      default:
        return 'Ordenar por';
    }
  }

  getStatusSeverity(
    status: string
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'delivered':
        return 'success';
      case 'confirmed':
      case 'shipped':
        return 'info';
      case 'pending':
        return 'warn';
      case 'cancelled':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      shipped: 'Enviada',
      delivered: 'Entregada',
      cancelled: 'Cancelada',
    };
    return labels[status] || status;
  }

  getStatusBadgeClass(status: OrderStatus): string {
    const baseClass =
      'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide';
    const colorClasses: Record<OrderStatus, string> = {
      pending: 'bg-orange-100 text-orange-600',
      confirmed: 'bg-blue-100 text-blue-600',
      shipped: 'bg-indigo-100 text-indigo-600',
      delivered: 'bg-green-100 text-green-600',
      cancelled: 'bg-red-100 text-red-600',
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
        (order) =>
          new Date(order.createdAt).toDateString() === today &&
          order.status !== 'cancelled'
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
      .items.filter((order) => order.status === 'delivered').length;
  }

  getWhatsAppLink(phone: string): string {
    // Remove all non-numeric characters except +
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    return `https://wa.me/${cleanPhone}`;
  }
}
