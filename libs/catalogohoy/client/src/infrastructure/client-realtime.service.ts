import { inject, Injectable, NgZone } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ClientStore } from './client.store';

@Injectable({ providedIn: 'root' })
export class ClientRealtimeService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);
  private readonly clientStore = inject(ClientStore);
  private readonly zone = inject(NgZone);
  private channel: RealtimeChannel | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async subscribe(): Promise<void> {
    this.unsubscribe();

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;

    console.log('[ClientRealtime] Subscribing to tenant:', tenantId);

    this.channel = this.client
      .channel(`clients-tenant-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('[ClientRealtime] Event received:', payload);
          this.zone.run(() => this.debouncedRefresh());
        }
      )
      .subscribe((status) => {
        console.log('[ClientRealtime] Channel status:', status);
      });
  }

  unsubscribe(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private debouncedRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.clientStore.loadClients();
      this.debounceTimer = null;
    }, 1000);
  }
}
