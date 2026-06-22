import { inject, Injectable, NgZone } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { RealtimeChannel } from '@supabase/supabase-js';
import { OrderStore } from './order.store';
import { OrderService } from './order.service';

@Injectable({ providedIn: 'root' })
export class OrderRealtimeService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);
  private readonly orderStore = inject(OrderStore);
  private readonly orderService = inject(OrderService);
  private readonly zone = inject(NgZone);
  private channel: RealtimeChannel | null = null;

  async subscribe(): Promise<void> {
    this.unsubscribe();

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;

    this.channel = this.client
      .channel(`orders-tenant-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          this.zone.run(() => this.handleChange(payload, tenantId));
        }
      )
      .subscribe();
  }

  unsubscribe(): void {
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private async handleChange(payload: any, tenantId: number): Promise<void> {
    const eventType = payload.eventType;

    if (eventType === 'INSERT') {
      const result = await this.orderService.getOrderById(payload.new.id, tenantId);
      result.mapRight((order) => this.orderStore.addOrder(order));
      // Keep "Total: X" footer in sync when a new order lands via realtime
      // (e.g., a client just placed an order from the public catalog).
      this.orderStore.loadGrandTotalCount();
    } else if (eventType === 'UPDATE') {
      const result = await this.orderService.getOrderById(payload.new.id, tenantId);
      result.mapRight((order) => this.orderStore.replaceOrder(order));
    } else if (eventType === 'DELETE') {
      this.orderStore.removeOrder(payload.old.id);
      this.orderStore.loadGrandTotalCount();
    }
  }
}
