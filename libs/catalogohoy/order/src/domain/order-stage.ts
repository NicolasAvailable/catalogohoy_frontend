import { OrderStatus } from './order';

/** Fila de `order_stages`. Con `systemStatus` es la personalización (nombre,
 *  color, orden, oculto) de un estado base; sin él es un estado propio de la
 *  tienda (ej. "Despacho") que se comporta como su `baseStatus`. */
export interface OrderStage {
  id: string;
  tenantId: number;
  label: string;
  /** Hex `#rrggbb` del punto de color. */
  color: string;
  baseStatus: OrderStatus;
  position: number;
  hidden: boolean;
  systemStatus: OrderStatus | null;
}

/** Valor de los selectores de estado: un estado base o `stage:<id>`. */
export type OrderStatusKey = OrderStatus | `stage:${string}`;

/** Opción "+ Crear estado" al final de los selectores de estado. */
export const NEW_STAGE_KEY = '__new_stage__';

/** Un estado tal como lo ve la tienda (base personalizado o propio). */
export interface OrderStatusDef {
  key: OrderStatusKey;
  label: string;
  color: string;
  baseStatus: OrderStatus;
  /** Estado base (no se puede borrar ni cambiar su comportamiento). */
  system: boolean;
  hidden: boolean;
  position: number;
  /** Id de la fila en `order_stages` (null = estado base sin personalizar). */
  rowId: string | null;
}

export interface OrderStatusOption {
  value: OrderStatusKey | typeof NEW_STAGE_KEY;
  label: string;
  color: string;
  baseStatus: OrderStatus;
  stageId: string | null;
}

export const NEW_STAGE_OPTION: OrderStatusOption = {
  value: NEW_STAGE_KEY,
  label: 'Crear estado',
  color: '',
  baseStatus: 'pending',
  stageId: null,
};

/** Nombre y color por defecto de los 4 estados base. */
export const BASE_STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: '#fb923c' },
  completed: { label: 'Completada', color: '#22c55e' },
  credit: { label: 'A crédito', color: '#3b82f6' },
  cancelled: { label: 'Cancelada', color: '#ef4444' },
};

const BASE_ORDER: OrderStatus[] = ['pending', 'completed', 'credit', 'cancelled'];

/** Paleta para elegir el color de un estado. */
export const ORDER_STAGE_COLORS = [
  '#fb923c', '#22c55e', '#3b82f6', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#14b8a6', '#eab308', '#6366f1',
  '#64748b', '#a16207',
];

/** Lo que hace un estado, como checks. Son escalonados: pagada implica que
 *  descuenta stock, y descontar stock implica que cuenta como venta. */
export interface StatusBehavior {
  /** Suma en ventas y ganancia (todo menos Cancelada). */
  countsAsSale: boolean;
  /** Saca los productos del inventario. */
  deductsStock: boolean;
  /** Se considera cobrada. */
  paid: boolean;
}

export function behaviorOf(status: OrderStatus): StatusBehavior {
  return {
    countsAsSale: status !== 'cancelled',
    deductsStock: status === 'completed' || status === 'credit',
    paid: status === 'completed',
  };
}

export function statusFromBehavior(b: StatusBehavior): OrderStatus {
  if (b.paid) return 'completed';
  if (b.deductsStock) return 'credit';
  if (b.countsAsSale) return 'pending';
  return 'cancelled';
}

/** Cambia un check respetando la escalera (marcar "pagada" marca los de
 *  abajo; desmarcar "venta" desmarca los de arriba). */
export function toggleBehavior(
  b: StatusBehavior,
  field: keyof StatusBehavior,
  value: boolean
): StatusBehavior {
  const ladder: (keyof StatusBehavior)[] = ['countsAsSale', 'deductsStock', 'paid'];
  const idx = ladder.indexOf(field);
  const next = { ...b };
  ladder.forEach((f, i) => {
    if (value && i <= idx) next[f] = true;
    if (!value && i >= idx) next[f] = false;
  });
  return next;
}

/** Todos los estados de la tienda, en su orden: los 4 base (con su
 *  personalización si la hay) + los propios. */
export function buildStatusDefs(rows: OrderStage[]): OrderStatusDef[] {
  const defs: OrderStatusDef[] = BASE_ORDER.map((status, i) => {
    const row = rows.find((r) => r.systemStatus === status);
    return {
      key: status,
      label: row?.label ?? BASE_STATUS_META[status].label,
      color: row?.color ?? BASE_STATUS_META[status].color,
      baseStatus: status,
      system: true,
      // Pendiente nunca se oculta: ahí llegan los pedidos nuevos.
      hidden: status === 'pending' ? false : row?.hidden ?? false,
      // Sin personalizar: Pendiente primero y los demás base al final, así
      // los propios quedan entre Pendiente y Completada.
      position: row?.position ?? (i === 0 ? -1000 : 1000 + i),
      rowId: row?.id ?? null,
    };
  });
  for (const r of rows) {
    if (r.systemStatus) continue;
    defs.push({
      key: `stage:${r.id}`,
      label: r.label,
      color: r.color,
      baseStatus: r.baseStatus,
      system: false,
      hidden: r.hidden,
      position: r.position,
      rowId: r.id,
    });
  }
  return defs.sort((a, b) => a.position - b.position);
}

export function toOption(def: OrderStatusDef): OrderStatusOption {
  return {
    value: def.key,
    label: def.label,
    color: def.color,
    baseStatus: def.baseStatus,
    stageId: def.system ? null : def.rowId,
  };
}

/** Clave del estado que se muestra para una orden. Un `stageId` que ya no
 *  existe (o que no coincide con el status) cae a su estado base. */
export function statusKeyOf(
  order: { status: OrderStatus; stageId?: string | null },
  defs: OrderStatusDef[]
): OrderStatusKey {
  if (order.stageId) {
    const def = defs.find((d) => !d.system && d.rowId === order.stageId);
    if (def && def.baseStatus === order.status) return def.key;
  }
  return order.status;
}

/** Traduce una clave del selector a lo que se guarda en la orden. */
export function resolveStatusKey(
  key: OrderStatusKey,
  defs: OrderStatusDef[]
): { status: OrderStatus; stageId: string | null } | null {
  if (key.startsWith('stage:')) {
    const def = defs.find((d) => d.key === key);
    return def ? { status: def.baseStatus, stageId: def.rowId } : null;
  }
  return { status: key as OrderStatus, stageId: null };
}
