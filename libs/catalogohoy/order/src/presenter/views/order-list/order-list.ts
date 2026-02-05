import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import {
  BadgeComponent,
  ButtonComponent,
  EmptyListComponent,
  IconComponent,
  TableComponent,
} from '@ui';
import { OrderStore } from '../../../infrastructure/order.store';

@Component({
  selector: 'lib-order-list',
  standalone: true,
  imports: [
    CommonModule,
    TableComponent,
    IconComponent,
    BadgeComponent,
    ButtonComponent,
    EmptyListComponent,
  ],
  templateUrl: './order-list.html',
  styleUrl: './order-list.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export class OrderListComponent implements OnInit {
  public readonly orderStore = inject(OrderStore);

  ngOnInit() {
    this.orderStore.loadOrders();
  }

  onCreateOrder() {}

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
}
