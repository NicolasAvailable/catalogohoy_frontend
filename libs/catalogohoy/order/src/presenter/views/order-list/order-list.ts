import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent,
  DatepickerComponent,
  EmptyListComponent,
  IconComponent,
  InputSearchComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
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
export class OrderListComponent implements OnInit {
  public readonly orderStore = inject(OrderStore);

  public searchQuery = '';
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

  setOrder(order: OrderBy) {
    this.selectedOrder.set(order);
  }

  onDateChange(date: Date | null) {
    this.selectedDate.set(date);
    this.orderStore.loadOrders(date ?? undefined);
  }

  clearDateFilter() {
    this.selectedDate.set(null);
    this.orderStore.loadOrders();
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
}
