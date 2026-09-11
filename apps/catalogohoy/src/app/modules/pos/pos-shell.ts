import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { EcommerceConfigStore } from '@catalogohoy/ecommerce-config';
import { IconComponent } from '@ui';

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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './pos-shell.html',
  styleUrl: './pos-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PosShell {
  private readonly configStore = inject(EcommerceConfigStore);

  readonly catalogName = computed(
    () => this.configStore.config()?.name || 'Punto de Venta'
  );

  readonly nav: RailItem[] = [
    { label: 'Venta', icon: 'shopping-cart', link: '/pos', exact: true },
    { label: 'Movimientos', icon: 'dollar-sign', link: '/pos/movimientos', exact: false },
    { label: 'Devoluciones', icon: 'undo-2', link: '/pos/devoluciones', exact: false },
    { label: 'Caja', icon: 'wallet', link: '/pos/caja', exact: false },
    { label: 'Estadísticas', icon: 'bar-chart-3', link: '/pos/estadisticas', exact: false },
  ];
}
