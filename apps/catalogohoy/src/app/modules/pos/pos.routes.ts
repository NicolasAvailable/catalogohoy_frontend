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
    data: {
      title: 'Movimientos de caja',
      icon: 'dollar-sign',
      desc: 'Registrá ingresos y egresos de efectivo de la caja durante el turno.',
    },
    loadComponent: () => import('./views/coming-soon/coming-soon'),
  },
  {
    path: 'devoluciones',
    data: {
      title: 'Devoluciones',
      icon: 'undo-2',
      desc: 'Buscá los productos de una venta y procesá la devolución: repone stock y reembolso.',
    },
    loadComponent: () => import('./views/coming-soon/coming-soon'),
  },
  {
    path: 'caja',
    data: {
      title: 'Caja',
      icon: 'wallet',
      desc: 'Abrí y cerrá caja con arqueo, y seguí los saldos por medio de pago.',
    },
    loadComponent: () => import('./views/coming-soon/coming-soon'),
  },
  {
    path: 'estadisticas',
    data: {
      title: 'Estadísticas',
      icon: 'bar-chart-3',
      desc: 'Ventas, facturación y ticket promedio por rango de fecha.',
    },
    loadComponent: () => import('./views/coming-soon/coming-soon'),
  },
  {
    path: 'configuracion',
    loadComponent: () => import('./views/config/config'),
  },
];
