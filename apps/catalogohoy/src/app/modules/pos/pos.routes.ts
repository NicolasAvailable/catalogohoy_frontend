import { Routes } from '@angular/router';

/**
 * Rutas hijas del Punto de Venta, renderizadas dentro del `<router-outlet>` del
 * shell (`pos-shell`). La sección Venta es la default; el resto son placeholders
 * hasta construirse en las próximas fases (ver plan CAT-63).
 */
export const posRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./views/venta/venta'),
  },
  {
    path: 'movimientos',
    loadComponent: () => import('./views/movimientos/movimientos'),
  },
  {
    path: 'devoluciones',
    loadComponent: () => import('./views/devoluciones/devoluciones'),
  },
  {
    path: 'caja',
    loadComponent: () => import('./views/caja/caja'),
  },
  {
    path: 'estadisticas',
    loadComponent: () => import('./views/estadisticas/estadisticas'),
  },
  {
    path: 'configuracion',
    loadComponent: () => import('./views/config/config'),
  },
];
