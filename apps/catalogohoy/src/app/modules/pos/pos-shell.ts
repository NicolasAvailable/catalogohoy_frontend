import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, TranslocoPipe],
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
