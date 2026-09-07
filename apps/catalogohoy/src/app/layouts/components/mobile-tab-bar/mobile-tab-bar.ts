import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { isNativeApp } from '@catalogohoy/core';
import { OrderStore } from '@catalogohoy/order';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { IconComponent } from '@ui';

/**
 * Barra de navegación inferior (bottom tab bar) — SOLO en la app nativa
 * (Capacitor). Estilo Shopify: 4 secciones principales + un botón "Más" (⋯) que
 * abre un drawer desde la derecha con el resto de opciones. En web no renderiza
 * nada ({@link isNativeApp} es false), así que es seguro montarla en el shell.
 *
 * El perfil NO vive aquí: está en el avatar del navbar superior (→ /admin/profile).
 */
@Component({
  selector: 'app-mobile-tab-bar',
  standalone: true,
  imports: [RouterLink, TranslocoPipe, IconComponent],
  templateUrl: './mobile-tab-bar.html',
})
export class MobileTabBar {
  /** ¿Está abierto el drawer "Más"? (lo pasa el shell) → resalta la pestaña ⋯. */
  public readonly menuOpen = input<boolean>(false);

  /** Botón "Más" (⋯): abre el drawer derecho manejado por el shell. */
  public readonly openMenu = output<void>();

  /** Constante por sesión: dentro de la app iOS/Android. */
  public readonly isNative = isNativeApp();

  private readonly router = inject(Router);
  private readonly orderStore = inject(OrderStore);
  private readonly permissions = inject(TeamPermissionsStore);

  /** Pedidos nuevos (badge en "Ordenes"). El contador lo mantiene vivo
   *  app-wide {@link OrderBadgeRealtimeService}, arrancado por el sidebar. */
  public readonly pendingOrdersCount = computed(() => this.orderStore.pendingCount());

  public readonly canViewProducts = computed(
    () => this.permissions.isOwner() || this.permissions.can()('productos', 'view')
  );
  public readonly canViewOrders = computed(
    () => this.permissions.isOwner() || this.permissions.can()('ordenes', 'view')
  );
  public readonly canViewClients = computed(
    () => this.permissions.isOwner() || this.permissions.can()('clientes', 'view')
  );

  /** URL actual (reactiva) para resaltar la pestaña activa. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  private readonly path = computed(() => this.currentUrl().split(/[?#]/)[0]);

  private isUnder(base: string): boolean {
    const p = this.path();
    return p === base || p.startsWith(base + '/');
  }

  public readonly homeActive = computed(
    () => this.path() === '/admin' || this.path() === '/admin/'
  );
  public readonly productsActive = computed(
    () => this.isUnder('/admin/products') || this.isUnder('/admin/categories')
  );
  public readonly ordersActive = computed(() => this.isUnder('/admin/orders'));
  public readonly clientsActive = computed(() => this.isUnder('/admin/clients'));
}
