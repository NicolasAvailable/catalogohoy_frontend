import {
  creditAgeDays,
  isCreditOverdue,
  nextInstallment,
  overdueInstallment,
} from './order';
import { OrderMapper } from './order.mapper';

/** "Hoy" fijo para los tests: 2026-09-24 mediodía local. */
const NOW = new Date(2026, 8, 24, 12, 0, 0);

const daysAgo = (n: number): string =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('creditAgeDays', () => {
  it('cuenta días de calendario desde la creación', () => {
    expect(creditAgeDays({ createdAt: daysAgo(12) }, NOW)).toBe(12);
    expect(creditAgeDays({ createdAt: daysAgo(0) }, NOW)).toBe(0);
  });

  it('tolera fechas inválidas o futuras sin negativos', () => {
    expect(creditAgeDays({ createdAt: 'no-es-fecha' }, NOW)).toBe(0);
    expect(creditAgeDays({ createdAt: daysAgo(-3) }, NOW)).toBe(0);
  });
});

describe('overdueInstallment / nextInstallment', () => {
  it('devuelve la cuota impaga vencida más vieja', () => {
    const order = {
      creditInstallments: [
        { dueDate: '2026-09-20', amount: 50 },
        { dueDate: '2026-09-10', amount: 30 },
        { dueDate: '2026-10-05', amount: 20 },
      ],
    };
    expect(overdueInstallment(order, NOW)?.dueDate).toBe('2026-09-10');
    expect(nextInstallment(order, NOW)?.dueDate).toBe('2026-10-05');
  });

  it('ignora cuotas pagadas', () => {
    const order = {
      creditInstallments: [
        { dueDate: '2026-09-10', paid: true },
        { dueDate: '2026-10-01' },
      ],
    };
    expect(overdueInstallment(order, NOW)).toBeNull();
    expect(nextInstallment(order, NOW)?.dueDate).toBe('2026-10-01');
  });

  it('la cuota que vence HOY todavía no está vencida', () => {
    const order = { creditInstallments: [{ dueDate: '2026-09-24' }] };
    expect(overdueInstallment(order, NOW)).toBeNull();
    expect(nextInstallment(order, NOW)?.dueDate).toBe('2026-09-24');
  });

  it('tolera jsonb malformado', () => {
    const order = {
      creditInstallments: [
        null,
        { amount: 10 },
        { dueDate: '2026-09-01' },
      ] as never,
    };
    expect(overdueInstallment(order, NOW)?.dueDate).toBe('2026-09-01');
  });
});

describe('isCreditOverdue', () => {
  it('sin cuotas: usa el umbral de días (estrictamente mayor)', () => {
    const base = { status: 'credit' as const, creditInstallments: null };
    expect(
      isCreditOverdue({ ...base, createdAt: daysAgo(8) }, 7, NOW)
    ).toBe(true);
    expect(
      isCreditOverdue({ ...base, createdAt: daysAgo(7) }, 7, NOW)
    ).toBe(false);
  });

  it('con cuotas: manda el plan, no el umbral', () => {
    const vieja = {
      status: 'credit' as const,
      createdAt: daysAgo(30),
      creditInstallments: [{ dueDate: '2026-10-15' }],
    };
    // 30 días de vieja pero su única cuota aún no vence → no molestar.
    expect(isCreditOverdue(vieja, 7, NOW)).toBe(false);

    const conVencida = {
      ...vieja,
      creditInstallments: [{ dueDate: '2026-09-20' }],
    };
    expect(isCreditOverdue(conVencida, 7, NOW)).toBe(true);
  });

  it('solo aplica a órdenes credit', () => {
    expect(
      isCreditOverdue(
        { status: 'pending', createdAt: daysAgo(30), creditInstallments: null },
        7,
        NOW
      )
    ).toBe(false);
  });
});

describe('OrderMapper.toDomain — credit_installments', () => {
  const base = {
    id: 1,
    name: 'Cliente',
    products: [],
    status: 'credit',
    tenant_id: 6,
    total_usd: 100,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    delivery_date: '2026-09-01',
  };

  it('normaliza cuotas válidas (amount numérico, paid boolean)', () => {
    const order = OrderMapper.toDomain({
      ...base,
      credit_installments: [
        { dueDate: '2026-10-01', amount: '50.5', paid: 1 },
        { dueDate: '2026-11-01' },
      ],
    });
    expect(order.creditInstallments).toEqual([
      { dueDate: '2026-10-01', amount: 50.5, paid: false },
      { dueDate: '2026-11-01', amount: null, paid: false },
    ]);
  });

  it('jsonb ausente, vacío o malformado → null', () => {
    expect(
      OrderMapper.toDomain({ ...base }).creditInstallments
    ).toBeNull();
    expect(
      OrderMapper.toDomain({ ...base, credit_installments: [] })
        .creditInstallments
    ).toBeNull();
    expect(
      OrderMapper.toDomain({ ...base, credit_installments: [{ amount: 5 }] })
        .creditInstallments
    ).toBeNull();
    expect(
      OrderMapper.toDomain({ ...base, credit_installments: 'legacy' })
        .creditInstallments
    ).toBeNull();
  });
});
