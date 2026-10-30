import {
  Expense,
  isOverdue,
  monthRange,
  shiftMonth,
  totalsByCategory,
  totalsByCurrency,
} from './expense.model';

const base: Expense = {
  id: '1',
  supplier: 'Proveedor',
  invoiceNumber: null,
  category: 'mercancia',
  description: null,
  amount: 10,
  currency: 'USD',
  issueDate: '2026-10-05',
  dueDate: null,
  status: 'paid',
  paidAt: null,
  fileUrl: null,
  fileName: null,
  notes: null,
  createdAt: '2026-10-05T00:00:00Z',
};

describe('expense.model', () => {
  it('monthRange cubre diciembre → enero', () => {
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2027-01-01' });
    expect(monthRange('2026-03')).toEqual({ from: '2026-03-01', to: '2026-04-01' });
  });

  it('shiftMonth cruza años', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('totalsByCurrency separa monedas y pone la principal primero', () => {
    const totals = totalsByCurrency(
      [
        { ...base, amount: 10.1 },
        { ...base, id: '2', amount: 5.2, status: 'pending' },
        { ...base, id: '3', amount: 1000, currency: 'VES' },
      ],
      'USD'
    );
    expect(totals[0]).toEqual({ currency: 'USD', total: 15.3, paid: 10.1, pending: 5.2 });
    expect(totals[1].currency).toBe('VES');
  });

  it('totalsByCurrency sin gastos devuelve la moneda principal en 0', () => {
    expect(totalsByCurrency([], 'USD')).toEqual([
      { currency: 'USD', total: 0, paid: 0, pending: 0 },
    ]);
  });

  it('totalsByCategory ordena de mayor a menor', () => {
    const cats = totalsByCategory(
      [
        { ...base, amount: 5, category: 'alquiler' },
        { ...base, id: '2', amount: 20 },
        { ...base, id: '3', amount: 99, currency: 'VES' },
      ],
      'USD'
    );
    expect(cats.map((c) => c.category)).toEqual(['mercancia', 'alquiler']);
  });

  it('isOverdue solo para por pagar con vencimiento pasado', () => {
    expect(isOverdue({ ...base, status: 'pending', dueDate: '2026-10-01' }, '2026-10-30')).toBe(true);
    expect(isOverdue({ ...base, status: 'paid', dueDate: '2026-10-01' }, '2026-10-30')).toBe(false);
    expect(isOverdue({ ...base, status: 'pending', dueDate: null }, '2026-10-30')).toBe(false);
  });
});
