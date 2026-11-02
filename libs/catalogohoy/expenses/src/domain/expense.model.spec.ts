import {
  attachmentIcon,
  dailyBreakdown,
  daysOfMonth,
  Expense,
  isAllowedExpenseFile,
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
  attachments: [],
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

  it('acepta fotos, PDF, Excel y XML; rechaza ejecutables', () => {
    expect(isAllowedExpenseFile({ name: 'f.pdf', type: 'application/pdf' })).toBe(true);
    expect(isAllowedExpenseFile({ name: 'f.xlsx', type: '' })).toBe(true);
    expect(isAllowedExpenseFile({ name: 'foto.heic', type: 'image/heic' })).toBe(true);
    expect(isAllowedExpenseFile({ name: 'factura.xml', type: 'text/xml' })).toBe(true);
    expect(isAllowedExpenseFile({ name: 'virus.exe', type: 'application/x-msdownload' })).toBe(false);
  });

  it('attachmentIcon por tipo', () => {
    expect(attachmentIcon({ name: 'a.xlsx', type: '' })).toBe('file-spreadsheet');
    expect(attachmentIcon({ name: 'a.png', type: 'image/png' })).toBe('image');
    expect(attachmentIcon({ name: 'a.pdf', type: 'application/pdf' })).toBe('file-text');
  });

  it('daysOfMonth cubre febrero bisiesto', () => {
    expect(daysOfMonth('2028-02')).toHaveLength(29);
    expect(daysOfMonth('2026-11')[29]).toBe('2026-11-30');
  });

  it('dailyBreakdown suma por día y categoría, ignora otras monedas', () => {
    const r = dailyBreakdown(
      [
        { ...base, amount: 10, issueDate: '2026-10-05' },
        { ...base, id: '2', amount: 5.5, issueDate: '2026-10-05' },
        { ...base, id: '3', amount: 7, category: 'transporte', issueDate: '2026-10-06' },
        { ...base, id: '4', amount: 99, currency: 'VES', issueDate: '2026-10-06' },
      ],
      '2026-10',
      'USD',
      'category'
    );
    expect(r.days).toHaveLength(31);
    expect(r.series.map((s) => s.key)).toEqual(['mercancia', 'transporte']);
    expect(r.series[0].data[4]).toBe(15.5);
    expect(r.series[1].data[5]).toBe(7);
  });

  it('dailyBreakdown por estado', () => {
    const r = dailyBreakdown(
      [{ ...base, status: 'pending', amount: 3 }],
      '2026-10',
      'USD',
      'status'
    );
    expect(r.series).toHaveLength(1);
    expect(r.series[0]).toMatchObject({ key: 'pending', name: 'Por pagar' });
  });
});
