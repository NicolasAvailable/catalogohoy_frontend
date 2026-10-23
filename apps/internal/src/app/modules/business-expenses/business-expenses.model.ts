export type ExpensePeriod = 'monthly' | 'yearly' | 'one_time';

export interface BusinessExpense {
  id: number;
  name: string;
  company: string;
  amountUsd: number;
  period: ExpensePeriod;
  /** Solo pagos únicos: mes del pago en formato 'YYYY-MM'. */
  expenseMonth: string | null;
  createdAt: string;
}

export function periodLabel(period: ExpensePeriod): string {
  if (period === 'one_time') return 'Pago único';
  return period === 'yearly' ? 'Anual' : 'Mensual';
}

export function isRecurring(expense: BusinessExpense): boolean {
  return expense.period !== 'one_time';
}

/** Costo normalizado a un mes (los anuales se prorratean /12). */
export function monthlyEquivalent(expense: BusinessExpense): number {
  if (expense.period === 'one_time') return 0;
  return expense.period === 'yearly'
    ? expense.amountUsd / 12
    : expense.amountUsd;
}

/** 'YYYY-MM' del mes actual (hora local). */
export function currentMonthKey(): string {
  return monthKey(new Date());
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' → 'octubre 2026'. */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('es', {
    month: 'long',
    year: 'numeric',
  });
}
