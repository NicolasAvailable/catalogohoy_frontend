import { inject, Injectable, NgZone } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { EcommerceStore } from './ecommerce.store';

/**
 * Mantiene la config del catálogo público FRESCA mientras el visitante navega
 * (en especial si está parado en el checkout): cuando el comerciante guarda
 * cambios en "Editar catálogo" el admin emite un broadcast de Realtime en el
 * canal `public-config-<tenantId>`, y acá se refetchea la config vía el RPC
 * público — así el botón "Realizar pedido" se activa EN VIVO si el dueño
 * recién configuró su vendedor de WhatsApp, sin salir ni recargar.
 *
 * Fallback: al volver la pestaña a visible se refresca igual (throttled) por
 * si el websocket murió en segundo plano. Todo best-effort: nunca rompe el
 * catálogo.
 */
@Injectable({ providedIn: 'root' })
export class CatalogConfigLiveService {
  private readonly store = inject(EcommerceStore);
  private readonly zone = inject(NgZone);

  private channel: RealtimeChannel | null = null;
  private slug = '';
  private lastRefreshAt = 0;
  private readonly visibilityHandler = (): void => {
    if (document.visibilityState === 'visible') {
      // Al volver a la pestaña: refresco de cortesía (mín. 30s entre ambos).
      this.refresh(30_000);
    }
  };

  /** Empieza a escuchar cambios de config del tenant. Idempotente. */
  public watch(slug: string, tenantId: number | string): void {
    this.unwatch();
    this.slug = slug;
    try {
      const client = SupabaseClientProvider.getInstance();
      this.channel = client
        .channel(`public-config-${tenantId}`)
        .on('broadcast', { event: 'config-updated' }, () => {
          // Los callbacks de Realtime corren fuera de la zona de Angular.
          this.zone.run(() => this.refresh(1_000));
        })
        .subscribe();
      document.addEventListener('visibilitychange', this.visibilityHandler);
    } catch {
      // Sin realtime seguimos: el catálogo funciona igual que antes.
    }
  }

  public unwatch(): void {
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.channel) {
      try {
        SupabaseClientProvider.getInstance().removeChannel(this.channel);
      } catch {
        // noop
      }
      this.channel = null;
    }
    this.slug = '';
  }

  private refresh(minIntervalMs: number): void {
    if (!this.slug) return;
    const now = Date.now();
    if (now - this.lastRefreshAt < minIntervalMs) return;
    this.lastRefreshAt = now;
    void this.store.refreshCatalogInfo(this.slug);
  }
}
