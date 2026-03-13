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

    console.log('[OrderRealtime] Subscribing to tenant:', tenantId);

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
          console.log('[OrderRealtime] Event received:', payload);
          this.zone.run(() => this.handleChange(payload, tenantId));
        }
      )
      .subscribe((status) => {
        console.log('[OrderRealtime] Channel status:', status);
      });
  }

  unsubscribe(): void {
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private async handleChange(payload: any, tenantId: number): Promise<void> {
    const eventType = payload.eventType;
    console.log('[OrderRealtime] handleChange:', eventType, 'isLoading before:', this.orderStore.isLoading());

    if (eventType === 'INSERT') {
      const result = await this.orderService.getOrderById(payload.new.id, tenantId);
      result.mapRight((order) => this.orderStore.addOrder(order));
    } else if (eventType === 'UPDATE') {
      const result = await this.orderService.getOrderById(payload.new.id, tenantId);
      console.log('[OrderRealtime] UPDATE fetched, isLoading:', this.orderStore.isLoading());
      result.mapRight((order) => this.orderStore.replaceOrder(order));
    } else if (eventType === 'DELETE') {
      console.log('[OrderRealtime] DELETE payload.old:', payload.old);
      this.orderStore.removeOrder(payload.old.id);
    }
  }
}
