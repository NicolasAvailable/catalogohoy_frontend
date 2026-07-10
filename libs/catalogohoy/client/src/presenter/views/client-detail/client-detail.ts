import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Clipboard } from '@angular/cdk/clipboard';
import { is } from '@shared/domain';
import { BaseComponent } from '@shared/presenter';
import {
  ButtonComponent,
  IconComponent,
  TooltipDirective,
} from '@ui';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { Order, OrderStatus } from '@catalogohoy/order';
import { TenantStore } from '@catalogohoy/tenant';
import { ClientStore } from '../../../infrastructure/client.store';
import { ClientFormDialogComponent } from '../../components/client-form-dialog/client-form-dialog';

@Component({
  selector: 'lib-client-detail',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    TooltipDirective,
    ButtonComponent,
    ClientFormDialogComponent,
    TranslocoPipe,
  ],
  templateUrl: './client-detail.html',
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden' },
})
export default class ClientDetailComponent extends BaseComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clipboard = inject(Clipboard);
  public readonly clientStore = inject(ClientStore);
  public readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly tenantStore = inject(TenantStore);
  public readonly cs = computed(() => this.tenantCurrency.localSymbol() || '$');

  @ViewChild(ClientFormDialogComponent)
  private editDialog!: ClientFormDialogComponent;

  ngOnInit() {
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (tid) this.tenantCurrency.load(tid);
    });

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

  openEdit() {
    const client = this.clientStore.selectedClient();
    if (client) this.editDialog.open(client);
  }

  onSaved() {
    const phone = this.clientStore.selectedClient()?.phone;
    if (phone) this.clientStore.loadClientByPhone(phone);
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

  formatDate(dateStr: string | null): string {
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
