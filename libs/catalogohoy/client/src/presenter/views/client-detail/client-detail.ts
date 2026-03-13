import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Clipboard } from '@angular/cdk/clipboard';
import { is } from '@shared/domain';
import { BaseComponent } from '@shared/presenter';
import {
  IconComponent,
  TooltipDirective,
} from '@ui';
import { Order, OrderStatus } from '@catalogohoy/order';
import { ClientStore } from '../../../infrastructure/client.store';

@Component({
  selector: 'lib-client-detail',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    TooltipDirective,
  ],
  templateUrl: './client-detail.html',
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden' },
})
export default class ClientDetailComponent extends BaseComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clipboard = inject(Clipboard);
  public readonly clientStore = inject(ClientStore);

  ngOnInit() {
    const phone = decodeURIComponent(
      this.route.snapshot.paramMap.get('phone') ?? ''
    );
    if (!phone) {
      this.router.navigate(['/admin/clients']);
      return;
    }
    this.clientStore.loadClientByPhone(phone);
  }

  goBack() {
    this.router.navigate(['/admin/clients']);
  }

  copyPhone() {
    const phone = this.clientStore.selectedClient()?.phone;
    if (!phone) return;
    is.affirmative(this.clipboard.copy(phone)).mapRight(() =>
      this.useCaseProgress
        .completeFor('Teléfono copiado al portapapeles')
        .complete()
    );
  }

  getWhatsAppLink(phone: string): string {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    return `https://wa.me/${cleanPhone}`;
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      pending: 'Pendiente',
      completed: 'Completada',
      cancelled: 'Cancelada',
    };
    return labels[status] || status;
  }

  getStatusDotClass(status: OrderStatus): string {
    const colors: Record<OrderStatus, string> = {
      pending: 'bg-orange-400',
      completed: 'bg-green-500',
      cancelled: 'bg-red-500',
    };
    return `w-2 h-2 rounded-full shrink-0 ${colors[status] ?? 'bg-grey-400'}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatDateTime(dateStr: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  navigateToOrder(order: Order) {
    this.router.navigate(['/admin/orders/edit', order.id]);
  }
}
