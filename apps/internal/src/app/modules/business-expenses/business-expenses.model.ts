export type ExpensePeriod = 'monthly' | 'yearly';

export interface BusinessExpense {
  id: number;
  name: string;
  company: string;
  amountUsd: number;
  period: ExpensePeriod;
  createdAt: string;
}

export function periodLabel(period: ExpensePeriod): string {
  return period === 'yearly' ? 'Anual' : 'Mensual';
}

/** Costo normalizado a un mes (los anuales se prorratean /12). */
export function monthlyEquivalent(expense: BusinessExpense): number {
  return expense.period === 'yearly'
    ? expense.amountUsd / 12
    : expense.amountUsd;
}
