import { inject, Injectable, NgZone } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { RealtimeChannel } from '@supabase/supabase-js';
import { OrderStore } from './order.store';

/**
 * App-wide realtime subscription that keeps the pending-order count in sync so
 * the sidebar "Ordenes" badge updates the instant an order arrives — no matter
 * which page the admin is on.
 *
 * Deliberately separate from {@link OrderRealtimeService}: that one owns a
 * single channel tied to the order-list page lifecycle (subscribe on enter /
 * unsubscribe on leave) and rebuilds the full order list on each event. This
 * one is owned by the always-mounted sidebar, uses its own channel, and does
 * the minimum work — a cheap count query — on any change.
 */
@Injectable({ providedIn: 'root' })
export class OrderBadgeRealtimeService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);
  private readonly orderStore = inject(OrderStore);
  private readonly zone = inject(NgZone);
  private channel: RealtimeChannel | null = null;

  async start(): Promise<void> {
    this.stop();

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;

    // Seed the badge with the current count before the first realtime event.
    this.orderStore.loadPendingCount();

    this.channel = this.client
      .channel(`orders-badge-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        // Any insert/update/delete can change how many orders are pending
        // (new order, status flipped to completed/cancelled, deletion).
        () => this.zone.run(() => this.orderStore.loadPendingCount())
      )
      .subscribe();
  }

  stop(): void {
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
