import type { ExpenseStatus } from './expense.model';

/** Fila de `expense_stages`. Con `systemStatus` es la personalización (nombre,
 *  color, orden, oculto) de un estado base; sin él es un estado propio de la
 *  tienda (ej. "A crédito") que se comporta como su `baseStatus`. */
export interface ExpenseStage {
  id: string;
  tenantId: number;
  label: string;
  /** Hex `#rrggbb`. */
  color: string;
  baseStatus: ExpenseStatus;
  position: number;
  hidden: boolean;
  systemStatus: ExpenseStatus | null;
}

/** Valor de los selectores de estado: un estado base o `stage:<id>`. */
export type ExpenseStatusKey = ExpenseStatus | `stage:${string}`;

/** Opción "+ Crear estado" al final del selector de estado. */
export const NEW_EXPENSE_STAGE_KEY = '__new_stage__';

/** Un estado tal como lo ve la tienda (base personalizado o propio). */
export interface ExpenseStatusDef {
  key: ExpenseStatusKey;
  label: string;
  color: string;
  baseStatus: ExpenseStatus;
  /** Estado base (no se puede borrar ni cambiar su comportamiento). */
  system: boolean;
  hidden: boolean;
  position: number;
  /** Id de la fila en `expense_stages` (null = base sin personalizar). */
  rowId: string | null;
}

/** Nombre y color por defecto de los 2 estados base. */
export const BASE_EXPENSE_STATUS_META: Record<ExpenseStatus, { label: string; color: string }> = {
  pending: { label: 'Por pagar', color: '#f97316' },
  paid: { label: 'Pagada', color: '#22c55e' },
};

/** Paleta para elegir el color de un estado. */
export const EXPENSE_STAGE_COLORS = [
  '#f97316', '#22c55e', '#3b82f6', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#14b8a6', '#eab308', '#6366f1',
  '#64748b', '#a16207',
];

/** Todos los estados de la tienda en su orden: los 2 base (con su
 *  personalización si la hay) + los propios. Sin personalizar, Por pagar va
 *  primero y Pagada al final, así los propios quedan en medio. */
export function buildExpenseStatusDefs(rows: ExpenseStage[]): ExpenseStatusDef[] {
  const defs: ExpenseStatusDef[] = (['pending', 'paid'] as ExpenseStatus[]).map((status) => {
    const row = rows.find((r) => r.systemStatus === status);
    return {
      key: status,
      label: row?.label ?? BASE_EXPENSE_STATUS_META[status].label,
      color: row?.color ?? BASE_EXPENSE_STATUS_META[status].color,
      baseStatus: status,
      system: true,
      hidden: row?.hidden ?? false,
      position: row?.position ?? (status === 'pending' ? -1000 : 1000),
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

/** Clave del estado de un gasto. Un `stageId` que ya no existe (o que no
 *  coincide con el status) cae a su estado base. */
export function expenseStatusKeyOf(
  expense: { status: ExpenseStatus; stageId?: string | null },
  defs: ExpenseStatusDef[]
): ExpenseStatusKey {
  if (expense.stageId) {
    const def = defs.find((d) => !d.system && d.rowId === expense.stageId);
    if (def && def.baseStatus === expense.status) return def.key;
  }
  return expense.status;
}

/** Traduce una clave del selector a lo que se guarda en el gasto. */
export function resolveExpenseStatusKey(
  key: ExpenseStatusKey,
  defs: ExpenseStatusDef[]
): { status: ExpenseStatus; stageId: string | null } | null {
  if (key.startsWith('stage:')) {
    const def = defs.find((d) => d.key === key);
    return def ? { status: def.baseStatus, stageId: def.rowId } : null;
  }
  return { status: key as ExpenseStatus, stageId: null };
}
