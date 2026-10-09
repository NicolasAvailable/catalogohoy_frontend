/**
 * Modelos del Punto de Venta (caja, movimientos, arqueo). El dinero se maneja en
 * la moneda de referencia del catálogo (el mismo monto que `orders.total_usd`,
 * que NO es necesariamente USD: es la base del catálogo). Se muestra con el
 * símbolo de la moneda del tenant.
 */

/** Estado de una caja. */
export type PosCashSessionStatus = 'open' | 'closed';

/** Una sesión de caja (apertura → cierre con arqueo). */
export interface PosCashSession {
  id: number;
  tenantId: number;
  status: PosCashSessionStatus;
  /** Efectivo inicial con el que se abre la caja. */
  openingFloat: number;
  openedByName: string | null;
  openedAt: string;
  closedByName: string | null;
  closedAt: string | null;
  /** Efectivo contado en el arqueo de cierre. */
  closingCounted: number | null;
  /** Efectivo esperado calculado al cerrar. */
  closingExpected: number | null;
  /** Diferencia (contado − esperado): positivo = sobra, negativo = falta. */
  closingDifference: number | null;
  registerName: string | null;
  notes: string | null;
}

/** Tipo de movimiento de caja. */
export type PosCashMovementType = 'in' | 'out';

/** Un ingreso/egreso manual de efectivo de la caja. */
export interface PosCashMovement {
  id: number;
  tenantId: number;
  sessionId: number;
  type: PosCashMovementType;
  /** Monto positivo; el tipo (`in`/`out`) decide el signo. */
  amount: number;
  reason: string | null;
  createdByName: string | null;
  createdAt: string;
}

/** Ventas agrupadas por medio de pago dentro de una sesión. */
export interface PosSalesByMethod {
  method: string;
  count: number;
  total: number;
}

/** Resumen/arqueo de una sesión de caja (calculado en el servicio). */
export interface PosSessionSummary {
  openingFloat: number;
  /** Ventas pagadas (status 'completed') de la sesión, por medio de pago. */
  salesByMethod: PosSalesByMethod[];
  /** Total vendido (todas las ventas pagadas de la sesión). */
  totalSales: number;
  salesCount: number;
  /** Ventas cobradas en efectivo (las que entran a la caja física). */
  cashSales: number;
  movementsIn: number;
  movementsOut: number;
  /** Efectivo que debería haber en la caja:
   *  inicial + ventas efectivo + ingresos − egresos. */
  expectedCash: number;
}

/** ¿El medio de pago es efectivo? (mismo criterio que el modal de cobro). */
export const isCashMethod = (method?: string | null): boolean =>
  /efectivo|cash|contado/i.test(method ?? '');
