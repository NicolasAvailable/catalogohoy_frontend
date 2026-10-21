/**
 * Pago dividido / mixto del Punto de Venta: el cobro de una venta se reparte
 * entre varios medios de pago (p. ej. una parte en efectivo y otra en pago
 * móvil). Estas funciones son puras para poder probar la aritmética del reparto
 * sin montar el componente ni la caja.
 *
 * El desglose se persiste en `orders.payments` ([{method, amount}]); el arqueo
 * de caja lo lee para saber la porción en efectivo. `payment_method` guarda solo
 * una etiqueta legible ("Efectivo + Pago móvil").
 */

/** Una fila del editor de pago dividido: un medio y el monto cobrado con él.
 *  `amount` es `null` mientras el cajero no escribió nada. */
export interface SplitRow {
  method: string;
  amount: number | null;
}

/** Desglose persistido/mostrado: cuánto se cobró con cada medio. */
export interface PosPayment {
  method: string;
  amount: number;
}

/** Tolerancia de centavos para considerar que el reparto "cuadra" (evita que un
 *  redondeo de 0.001 deje el cobro bloqueado). */
const EPS = 0.005;

/** Suma ya asignada en las filas (ignora las vacías). */
export const splitAssigned = (rows: SplitRow[]): number =>
  rows.reduce((t, r) => t + (r.amount || 0), 0);

/** Lo que falta por asignar para llegar al total (negativo = se pasaron). */
export const splitRemaining = (total: number, rows: SplitRow[]): number =>
  total - splitAssigned(rows);

/** El reparto cuadra: hay al menos un medio con monto > 0 y la suma iguala el
 *  total a cobrar dentro de la tolerancia de centavos. */
export const isSplitBalanced = (total: number, rows: SplitRow[]): boolean => {
  const filled = rows.filter((r) => r.method && (r.amount || 0) > 0);
  return filled.length > 0 && Math.abs(splitRemaining(total, rows)) < EPS;
};

/** Monto que hay que poner en la fila `i` para cuadrar el reparto ("poner el
 *  resto"): lo que falta + lo que ya tenía esa fila, nunca negativo, a centavos. */
export const fillRemainingAmount = (
  total: number,
  rows: SplitRow[],
  i: number
): number => {
  const rest = splitRemaining(total, rows) + (rows[i]?.amount || 0);
  return Math.max(0, Math.round(rest * 100) / 100);
};

/** Desglose a persistir: solo filas con monto > 0, redondeado a centavos.
 *  `null` = no es pago dividido (se cobró con un solo medio). */
export const splitPaymentsList = (rows: SplitRow[]): PosPayment[] | null => {
  const list = rows
    .filter((r) => r.method && (r.amount || 0) > 0)
    .map((r) => ({
      method: r.method,
      amount: Math.round((r.amount || 0) * 100) / 100,
    }));
  return list.length ? list : null;
};

/** Etiqueta legible de los medios usados, sin repetir: "Efectivo + Pago móvil". */
export const splitMethodLabel = (rows: SplitRow[]): string => {
  const used = [
    ...new Set(
      rows.filter((r) => (r.amount || 0) > 0 && r.method).map((r) => r.method)
    ),
  ];
  return used.join(' + ');
};

/** Reparte una orden en sus partes por medio de pago para el arqueo: usa el
 *  desglose `payments` si existe; si no, el medio único con el total de la orden.
 *  `num` convierte el valor crudo de la DB (string|number|null) a número. */
export const paymentPartsOf = (
  row: {
    payment_method: string | null;
    payments: { method?: string; amount?: number }[] | null;
  },
  total: number,
  num: (v: number | string | null | undefined) => number
): PosPayment[] =>
  Array.isArray(row.payments) && row.payments.length
    ? row.payments.map((p) => ({
        method: (p.method || 'Sin especificar').trim(),
        amount: num(p.amount),
      }))
    : [{ method: (row.payment_method || 'Sin especificar').trim(), amount: total }];
