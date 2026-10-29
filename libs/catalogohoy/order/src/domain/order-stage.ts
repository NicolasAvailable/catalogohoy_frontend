import { OrderStatus } from './order';

/** Estado de orden propio de una tienda (tabla `order_stages`), ej. "Despacho"
 *  o "Revisión". Se comporta como su `baseStatus`: ese es el que decide stock,
 *  métricas y notificaciones; el estado propio es la columna que se ve. */
export interface OrderStage {
  id: string;
  tenantId: number;
  label: string;
  /** Hex `#rrggbb` del punto de color. */
  color: string;
  baseStatus: OrderStatus;
  position: number;
}

/** Valor de los selectores de estado: un estado base o `stage:<id>`. */
export type OrderStatusKey = OrderStatus | `stage:${string}`;

export interface OrderStatusOption {
  value: OrderStatusKey;
  label: string;
  color: string;
  baseStatus: OrderStatus;
  stageId: string | null;
}

/** Nombre y color de los 4 estados base (mismos colores que tenían los badges). */
export const BASE_STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: '#fb923c' },
  completed: { label: 'Completada', color: '#22c55e' },
  credit: { label: 'A crédito', color: '#3b82f6' },
  cancelled: { label: 'Cancelada', color: '#ef4444' },
};

/** Qué hace cada comportamiento, para el editor de estados. */
export const BASE_STATUS_BEHAVIOR: { value: OrderStatus; label: string; hint: string }[] = [
  { value: 'pending', label: 'Como Pendiente', hint: 'No descuenta stock' },
  { value: 'completed', label: 'Como Completada', hint: 'Descuenta stock y cuenta como venta pagada' },
  { value: 'credit', label: 'Como A crédito', hint: 'Descuenta stock, queda por cobrar' },
  { value: 'cancelled', label: 'Como Cancelada', hint: 'No descuenta stock ni cuenta en ventas' },
];

/** Paleta para elegir el color de un estado propio. */
export const ORDER_STAGE_COLORS = [
  '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#eab308',
  '#f97316', '#6366f1', '#64748b', '#84cc16', '#a16207',
];

const baseOption = (status: OrderStatus): OrderStatusOption => ({
  value: status,
  label: BASE_STATUS_META[status].label,
  color: BASE_STATUS_META[status].color,
  baseStatus: status,
  stageId: null,
});

/** Opciones de estado en orden de flujo: Pendiente, los estados propios (por
 *  posición), Completada, A crédito y Cancelada. */
export function buildStatusOptions(stages: OrderStage[]): OrderStatusOption[] {
  const own = [...stages]
    .sort((a, b) => a.position - b.position)
    .map<OrderStatusOption>((s) => ({
      value: `stage:${s.id}`,
      label: s.label,
      color: s.color,
      baseStatus: s.baseStatus,
      stageId: s.id,
    }));
  return [
    baseOption('pending'),
    ...own,
    baseOption('completed'),
    baseOption('credit'),
    baseOption('cancelled'),
  ];
}

/** Clave del estado que se muestra para una orden. Un `stageId` que ya no
 *  existe (o que no coincide con el status) cae a su estado base. */
export function statusKeyOf(
  order: { status: OrderStatus; stageId?: string | null },
  stages: OrderStage[]
): OrderStatusKey {
  if (order.stageId) {
    const stage = stages.find((s) => s.id === order.stageId);
    if (stage && stage.baseStatus === order.status) return `stage:${stage.id}`;
  }
  return order.status;
}

/** Traduce una clave del selector a lo que se guarda en la orden. */
export function resolveStatusKey(
  key: OrderStatusKey,
  stages: OrderStage[]
): { status: OrderStatus; stageId: string | null } | null {
  if (key.startsWith('stage:')) {
    const stage = stages.find((s) => `stage:${s.id}` === key);
    return stage ? { status: stage.baseStatus, stageId: stage.id } : null;
  }
  return { status: key as OrderStatus, stageId: null };
}
