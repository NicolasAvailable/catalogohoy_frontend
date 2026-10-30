// Gastos de la tienda (`tenant_expenses`): facturas de proveedores, compras de
// mercancía y otros pagos. Base del balance mensual (gastos vs. ventas).

export type ExpenseStatus = 'pending' | 'paid';

export type ExpenseCategory =
  | 'mercancia'
  | 'servicios'
  | 'transporte'
  | 'alquiler'
  | 'sueldos'
  | 'impuestos'
  | 'publicidad'
  | 'otros';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'mercancia', label: 'Mercancía / productos' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'transporte', label: 'Transporte y envíos' },
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'sueldos', label: 'Sueldos' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'publicidad', label: 'Publicidad' },
  { value: 'otros', label: 'Otros' },
];

export const EXPENSE_STATUSES: { value: ExpenseStatus; label: string }[] = [
  { value: 'paid', label: 'Pagada' },
  { value: 'pending', label: 'Por pagar' },
];

export function categoryLabel(category: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? 'Otros';
}

export interface Expense {
  id: string;
  supplier: string | null;
  invoiceNumber: string | null;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  currency: string;
  /** Fecha de la factura, 'YYYY-MM-DD'. */
  issueDate: string;
  dueDate: string | null;
  status: ExpenseStatus;
  paidAt: string | null;
  fileUrl: string | null;
  fileName: string | null;
  notes: string | null;
  createdAt: string;
}

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt'>;

/** Mes 'YYYY-MM' → rango de fechas [desde, hasta) en 'YYYY-MM-DD'. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { from: `${month}-01`, to: `${next}-01` };
}

/** Mes actual 'YYYY-MM' en hora local. */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Suma `delta` meses a 'YYYY-MM'. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return currentMonth(d);
}

/** Date → 'YYYY-MM-DD' (hora local, sin corrimiento por zona horaria). */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → Date a medianoche local. */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface CurrencyTotals {
  currency: string;
  total: number;
  paid: number;
  pending: number;
}

/** Totales por moneda (una factura en Bs no se suma con una en USD). La
 *  moneda principal de la tienda va primero. */
export function totalsByCurrency(
  expenses: Expense[],
  mainCurrency: string
): CurrencyTotals[] {
  const map = new Map<string, CurrencyTotals>();
  for (const e of expenses) {
    const t = map.get(e.currency) ?? { currency: e.currency, total: 0, paid: 0, pending: 0 };
    t.total += e.amount;
    if (e.status === 'paid') t.paid += e.amount;
    else t.pending += e.amount;
    map.set(e.currency, t);
  }
  if (!map.size) map.set(mainCurrency, { currency: mainCurrency, total: 0, paid: 0, pending: 0 });
  const round = (n: number) => Math.round(n * 100) / 100;
  return [...map.values()]
    .map((t) => ({ ...t, total: round(t.total), paid: round(t.paid), pending: round(t.pending) }))
    .sort((a, b) =>
      a.currency === mainCurrency ? -1 : b.currency === mainCurrency ? 1 : a.currency.localeCompare(b.currency)
    );
}

/** Gasto por categoría (solo la moneda indicada), de mayor a menor. */
export function totalsByCategory(
  expenses: Expense[],
  currency: string
): { category: ExpenseCategory; label: string; total: number }[] {
  const map = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    if (e.currency !== currency) continue;
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({
      category,
      label: categoryLabel(category),
      total: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total);
}

/** ¿Factura por pagar y ya vencida? */
export function isOverdue(expense: Expense, today = toIsoDate(new Date())): boolean {
  return expense.status === 'pending' && !!expense.dueDate && expense.dueDate < today;
}
