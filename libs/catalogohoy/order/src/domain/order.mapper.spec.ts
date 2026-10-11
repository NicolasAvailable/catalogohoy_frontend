import { OrderMapper } from './order.mapper';

/** Cubre la normalización de `payment_adjustment` (jsonb) → dominio
 *  (OrderAdjustment) que agrega CAT-74. Se prueba a través de la API pública
 *  `toDomain` (el helper `toAdjustment` es privado). */
describe('OrderMapper.toDomain — payment_adjustment', () => {
  const base = {
    id: 1,
    name: 'Cliente',
    products: [],
    status: 'pending',
    tenant_id: 6,
    total_usd: 10,
    delivery_date: '2026-01-01',
  };

  it('mapea un descuento válido tal cual', () => {
    const o = OrderMapper.toDomain({
      ...base,
      payment_adjustment: {
        label: 'Descuento · Contado (5%)',
        amount: -0.9,
        magnitude: 0.9,
        kind: 'discount',
      },
    });
    expect(o.paymentAdjustment).toEqual({
      label: 'Descuento · Contado (5%)',
      amount: -0.9,
      magnitude: 0.9,
      kind: 'discount',
      visible: true,
    });
  });

  it('visible=true por default; respeta visible=false explícito', () => {
    expect(
      OrderMapper.toDomain({
        ...base,
        payment_adjustment: { label: 'D', amount: -1, magnitude: 1, kind: 'discount' },
      }).paymentAdjustment?.visible
    ).toBe(true);
    expect(
      OrderMapper.toDomain({
        ...base,
        payment_adjustment: { label: 'D', amount: -1, magnitude: 1, kind: 'discount', visible: false },
      }).paymentAdjustment?.visible
    ).toBe(false);
  });

  it('mapea un recargo (surcharge) válido', () => {
    const o = OrderMapper.toDomain({
      ...base,
      payment_adjustment: {
        label: 'Recargo · Tarjeta (3%)',
        amount: 0.3,
        magnitude: 0.3,
        kind: 'surcharge',
      },
    });
    expect(o.paymentAdjustment?.kind).toBe('surcharge');
    expect(o.paymentAdjustment?.amount).toBe(0.3);
  });

  it('null cuando no hay ajuste (ausente o null)', () => {
    expect(OrderMapper.toDomain(base).paymentAdjustment).toBeNull();
    expect(
      OrderMapper.toDomain({ ...base, payment_adjustment: null }).paymentAdjustment
    ).toBeNull();
  });

  it('null cuando amount es 0 o falta el label', () => {
    expect(
      OrderMapper.toDomain({
        ...base,
        payment_adjustment: { label: 'x', amount: 0, kind: 'discount' },
      }).paymentAdjustment
    ).toBeNull();
    expect(
      OrderMapper.toDomain({
        ...base,
        payment_adjustment: { amount: -1, kind: 'discount' },
      }).paymentAdjustment
    ).toBeNull();
  });

  it('deriva magnitude de |amount| si falta y default kind=discount', () => {
    const o = OrderMapper.toDomain({
      ...base,
      payment_adjustment: { label: 'D', amount: -2 },
    });
    expect(o.paymentAdjustment).toEqual({
      label: 'D',
      amount: -2,
      magnitude: 2,
      kind: 'discount',
      visible: true,
    });
  });

  it('ignora basura / valores no-objeto', () => {
    expect(
      OrderMapper.toDomain({ ...base, payment_adjustment: 'nope' })
        .paymentAdjustment
    ).toBeNull();
    expect(
      OrderMapper.toDomain({ ...base, payment_adjustment: { amount: 'x' } })
        .paymentAdjustment
    ).toBeNull();
  });
});
