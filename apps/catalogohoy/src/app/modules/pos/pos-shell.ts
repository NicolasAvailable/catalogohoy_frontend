import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import {
  EcommerceConfigStore,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { TranslocoPipe } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';
import { IconComponent } from '@ui';
import { PosCajaStore } from './pos-caja.store';

interface RailItem {
  label: string;
  icon: string;
  link: string;
  exact: boolean;
}

/**
 * Cascarón full-screen del Punto de Venta: barra lateral propia (estilo
 * TiendaNube) con las secciones + engranaje de configuración, y un `<router-outlet>`
 * para la vista activa. Vive fuera del layout del admin (ruta top-level `/pos`).
 */
@Component({
  selector: 'pos-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    TranslocoPipe,
    TooltipModule,
  ],
  templateUrl: './pos-shell.html',
  styleUrl: './pos-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PosShell implements OnInit {
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  readonly caja = inject(PosCajaStore);

  readonly catalogName = computed(
    () => this.configStore.config()?.name || 'Punto de Venta'
  );

  /** Logo del catálogo del cliente (mismo que el storefront/admin). Si no hay,
   *  el rail cae al ícono de tienda. */
  readonly catalogLogo = computed(() => this.configStore.config()?.logo || null);

  constructor() {
    // Título de la VENTANA/pestaña del POS: "Punto de venta | <catálogo>" (se
    // actualiza solo cuando carga la config).
    effect(() => {
      const name = this.configStore.config()?.name;
      document.title = name ? `Punto de venta | ${name}` : 'Punto de venta';
    });
  }

  /** Salir del POS. Como el POS se abre en una VENTANA nueva (window.open desde
   *  el admin), lo natural es CERRAR esa ventana y devolver el foco al panel. Si
   *  se entró directo a /pos escribiendo la URL (sin ventana padre), el navegador
   *  bloquea window.close() → navegamos al admin. */
  exitPos(): void {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    window.location.href = '/admin';
  }

  ngOnInit(): void {
    // El shell es el único componente siempre montado del POS: deja listos el
    // config/moneda (para el símbolo en todas las vistas) y la caja abierta
    // (para el badge y para imputar las ventas), sin importar a qué sección se
    // entre primero.
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (!tid) return;
      this.configStore.loadConfig(String(tid));
      this.tenantCurrency.load(tid);
    });
    this.caja.loadOpenSession();
  }

  readonly nav: RailItem[] = [
    { label: 'Venta', icon: 'shopping-cart', link: '/pos', exact: true },
    { label: 'Movimientos', icon: 'dollar-sign', link: '/pos/movimientos', exact: false },
    { label: 'Devoluciones', icon: 'rotate-ccw', link: '/pos/devoluciones', exact: false },
    { label: 'Caja', icon: 'wallet', link: '/pos/caja', exact: false },
    { label: 'Estadísticas', icon: 'bar-chart-3', link: '/pos/estadisticas', exact: false },
  ];
}
