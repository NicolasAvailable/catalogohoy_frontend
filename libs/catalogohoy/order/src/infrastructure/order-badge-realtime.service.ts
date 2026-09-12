import { inject, Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import {
  NotificationSoundService,
  SupabaseClientProvider,
} from '@catalogohoy/core';
import { ProfileStore } from '@catalogohoy/profile';
import { TenantStore } from '@catalogohoy/tenant';
import { ToastService } from '@shared/infrastructure';
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
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly sound = inject(NotificationSoundService);
  private readonly profileStore = inject(ProfileStore);
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
        // (new order, status flipped to completed/cancelled, deletion). Un
        // INSERT además dispara el aviso in-app (sonido + toast) al dueño.
        (payload) =>
          this.zone.run(() => {
            this.orderStore.loadPendingCount();
            if (payload.eventType === 'INSERT') {
              this.notifyNewOrder(
                (payload.new as { name?: string })?.name ?? ''
              );
            }
          })
      )
      .subscribe();
  }

  /** Aviso in-app cuando entra una orden nueva por realtime: suena una
   *  campanita y aparece un toast con el nombre del cliente y un acceso directo
   *  a "Órdenes". El badge del sidebar se actualiza aparte (loadPendingCount). */
  private notifyNewOrder(customerName: string): void {
    // Preferencia por usuario (Perfil → Notificaciones): si apagó el aviso en la
    // app, no suena ni aparece el toast. El badge del sidebar se actualiza igual.
    if (this.profileStore.profile().notifyOrdersInapp === false) return;
    this.sound.play();
    const name = customerName.trim();
    this.toast.notify('Nueva orden recibida', {
      description: name || undefined,
      actionKey: 'Ver',
      onAction: () =>
        this.zone.run(() => this.router.navigate(['/admin/orders'])),
    });
  }

  stop(): void {
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
