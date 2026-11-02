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
  { value: 'mercancia', label: 'Mercancía' },
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

/** Archivo adjunto de un gasto (foto, PDF, Excel…), servido desde el CDN. */
export interface ExpenseAttachment {
  url: string;
  name: string;
  /** MIME type del archivo original. */
  type: string;
}

/** Tipos que se aceptan como factura (fotos, PDF, Excel/CSV, Word, XML de
 *  factura electrónica). */
export const EXPENSE_FILE_ACCEPT =
  'image/*,application/pdf,.pdf,.xls,.xlsx,.csv,.doc,.docx,.xml,.txt';

const ALLOWED_EXTENSIONS = ['pdf', 'xls', 'xlsx', 'csv', 'doc', 'docx', 'xml', 'txt', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];

/** ¿Se puede adjuntar este archivo como factura? */
export function isAllowedExpenseFile(file: { name: string; type: string }): boolean {
  // SVG no: puede llevar scripts y se sirve desde nuestro CDN.
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) return false;
  if (file.type.startsWith('image/') || file.type === 'application/pdf') return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_EXTENSIONS.includes(ext);
}

/** Ícono (lucide) según el tipo de archivo. */
export function attachmentIcon(att: { name: string; type: string }): string {
  const ext = att.name.split('.').pop()?.toLowerCase() ?? '';
  if (att.type.startsWith('image/')) return 'image';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'file-spreadsheet';
  return 'file-text';
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
  attachments: ExpenseAttachment[];
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

/** Colores fijos por categoría y por estado (gráfica por día). */
export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  mercancia: '#6366f1',
  servicios: '#0ea5e9',
  transporte: '#f59e0b',
  alquiler: '#8b5cf6',
  sueldos: '#10b981',
  impuestos: '#ef4444',
  publicidad: '#ec4899',
  otros: '#94a3b8',
};

export const EXPENSE_STATUS_COLORS: Record<ExpenseStatus, string> = {
  paid: '#22c55e',
  pending: '#f97316',
};

export type ExpenseBreakdown = 'category' | 'status';

/** Todos los días del mes 'YYYY-MM' en 'YYYY-MM-DD'. */
export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** Gasto por día del mes (solo la moneda indicada), una serie por categoría o
 *  por estado. Solo incluye las series que tienen algún gasto. */
export function dailyBreakdown(
  expenses: Expense[],
  month: string,
  currency: string,
  by: ExpenseBreakdown
): { days: string[]; series: { key: string; name: string; color: string; data: number[] }[] } {
  const days = daysOfMonth(month);
  const index = new Map(days.map((d, i) => [d, i]));
  const keys =
    by === 'category'
      ? EXPENSE_CATEGORIES.map((c) => ({ key: c.value, name: c.label, color: EXPENSE_CATEGORY_COLORS[c.value] }))
      : EXPENSE_STATUSES.map((s) => ({ key: s.value, name: s.label, color: EXPENSE_STATUS_COLORS[s.value] }));
  const data = new Map(keys.map((k) => [k.key, days.map(() => 0)]));
  for (const e of expenses) {
    if (e.currency !== currency) continue;
    const i = index.get(e.issueDate);
    if (i === undefined) continue;
    const row = data.get(by === 'category' ? e.category : e.status);
    if (row) row[i] = Math.round((row[i] + e.amount) * 100) / 100;
  }
  return {
    days,
    series: keys
      .map((k) => ({ ...k, data: data.get(k.key)! }))
      .filter((s) => s.data.some((v) => v > 0)),
  };
}
