import {
  fillRemainingAmount,
  isSplitBalanced,
  paymentPartsOf,
  splitAssigned,
  splitMethodLabel,
  splitPaymentsList,
  splitRemaining,
  SplitRow,
} from './pos-split.util';

/** Conversor crudo→número como el de pos.service (`num`). */
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

describe('pos-split.util', () => {
  describe('splitAssigned', () => {
    it('suma los montos e ignora las filas vacías', () => {
      const rows: SplitRow[] = [
        { method: 'Efectivo', amount: 20 },
        { method: 'Pago móvil', amount: 15 },
        { method: 'Tarjeta', amount: null },
      ];
      expect(splitAssigned(rows)).toBe(35);
    });

    it('vacío = 0', () => {
      expect(splitAssigned([])).toBe(0);
    });
  });

  describe('splitRemaining', () => {
    it('positivo cuando falta por asignar', () => {
      const rows: SplitRow[] = [{ method: 'Efectivo', amount: 20 }];
      expect(splitRemaining(50, rows)).toBe(30);
    });

    it('negativo cuando se pasaron', () => {
      const rows: SplitRow[] = [
        { method: 'Efectivo', amount: 40 },
        { method: 'Tarjeta', amount: 20 },
      ];
      expect(splitRemaining(50, rows)).toBe(-10);
    });
  });

  describe('isSplitBalanced', () => {
    it('cuadra cuando la suma iguala el total', () => {
      const rows: SplitRow[] = [
        { method: 'Efectivo', amount: 20 },
        { method: 'Pago móvil', amount: 30 },
      ];
      expect(isSplitBalanced(50, rows)).toBe(true);
    });

    it('no cuadra si falta o sobra', () => {
      expect(isSplitBalanced(50, [{ method: 'Efectivo', amount: 20 }])).toBe(false);
      expect(
        isSplitBalanced(50, [
          { method: 'Efectivo', amount: 40 },
          { method: 'Tarjeta', amount: 20 },
        ])
      ).toBe(false);
    });

    it('no cuadra sin ninguna fila con monto > 0', () => {
      expect(isSplitBalanced(0, [])).toBe(false);
      expect(isSplitBalanced(0, [{ method: 'Efectivo', amount: 0 }])).toBe(false);
      expect(isSplitBalanced(0, [{ method: 'Efectivo', amount: null }])).toBe(
        false
      );
    });

    it('tolera el redondeo a centavos (33.33 + 33.33 + 33.34 = 100)', () => {
      const rows: SplitRow[] = [
        { method: 'Efectivo', amount: 33.33 },
        { method: 'Pago móvil', amount: 33.33 },
        { method: 'Tarjeta', amount: 33.34 },
      ];
      expect(isSplitBalanced(100, rows)).toBe(true);
    });

    it('un centavo de diferencia NO cuadra', () => {
      const rows: SplitRow[] = [
        { method: 'Efectivo', amount: 20 },
        { method: 'Tarjeta', amount: 29.99 },
      ];
      expect(isSplitBalanced(50, rows)).toBe(false);
    });
  });

  describe('fillRemainingAmount', () => {
    it('pone exactamente lo que falta en una fila vacía', () => {
      const rows: SplitRow[] = [
        { method: 'Efectivo', amount: 20 },
        { method: 'Pago móvil', amount: null },
      ];
      expect(fillRemainingAmount(50, rows, 1)).toBe(30);
    });

    it('al "poner el resto" en una fila con monto, ajusta esa fila para cuadrar', () => {
      const rows: SplitRow[] = [
        { method: 'Efectivo', amount: 20 },
        { method: 'Pago móvil', amount: 5 },
      ];
      // Falta 25; esta fila ya tiene 5 → debe quedar en 30 para cuadrar 50.
      expect(fillRemainingAmount(50, rows, 1)).toBe(30);
    });

    it('nunca negativo cuando ya se pasaron', () => {
      const rows: SplitRow[] = [
        { method: 'Efectivo', amount: 60 },
        { method: 'Tarjeta', amount: 0 },
      ];
      expect(fillRemainingAmount(50, rows, 1)).toBe(0);
    });
  });

  describe('splitPaymentsList', () => {
    it('devuelve solo filas con monto > 0, redondeadas a centavos', () => {
      const rows: SplitRow[] = [
        { method: 'Efectivo', amount: 20.005 },
        { method: 'Pago móvil', amount: 0 },
        { method: 'Tarjeta', amount: null },
        { method: 'Zelle', amount: 14.999 },
      ];
      expect(splitPaymentsList(rows)).toEqual([
        { method: 'Efectivo', amount: 20.01 },
        { method: 'Zelle', amount: 15 },
      ]);
    });

    it('null cuando no hay ninguna fila con monto', () => {
      expect(splitPaymentsList([{ method: 'Efectivo', amount: null }])).toBeNull();
      expect(splitPaymentsList([])).toBeNull();
    });
  });

  describe('splitMethodLabel', () => {
    it('une los medios usados sin repetir', () => {
      const rows: SplitRow[] = [
        { method: 'Efectivo', amount: 20 },
        { method: 'Pago móvil', amount: 15 },
      ];
      expect(splitMethodLabel(rows)).toBe('Efectivo + Pago móvil');
    });

    it('deduplica cuando dos filas usan el mismo medio', () => {
      const rows: SplitRow[] = [
        { method: 'Efectivo', amount: 20 },
        { method: 'Efectivo', amount: 15 },
      ];
      expect(splitMethodLabel(rows)).toBe('Efectivo');
    });

    it('ignora filas sin monto', () => {
      const rows: SplitRow[] = [
        { method: 'Efectivo', amount: 20 },
        { method: 'Tarjeta', amount: null },
      ];
      expect(splitMethodLabel(rows)).toBe('Efectivo');
    });
  });

  describe('paymentPartsOf (arqueo)', () => {
    it('reparte por el desglose cuando existe', () => {
      const row = {
        payment_method: 'Efectivo + Pago móvil',
        payments: [
          { method: 'Efectivo', amount: 20 },
          { method: 'Pago móvil', amount: 30 },
        ],
      };
      expect(paymentPartsOf(row, 50, num)).toEqual([
        { method: 'Efectivo', amount: 20 },
        { method: 'Pago móvil', amount: 30 },
      ]);
    });

    it('sin desglose usa el medio único con el total (comportamiento histórico)', () => {
      const row = { payment_method: 'Tarjeta', payments: null };
      expect(paymentPartsOf(row, 50, num)).toEqual([
        { method: 'Tarjeta', amount: 50 },
      ]);
    });

    it('medio sin especificar cuando falta el nombre', () => {
      expect(paymentPartsOf({ payment_method: null, payments: null }, 10, num)).toEqual(
        [{ method: 'Sin especificar', amount: 10 }]
      );
    });

    it('solo la porción en efectivo del desglose cuenta como efectivo', () => {
      // Simula el cálculo de cashSales del arqueo sobre una venta mixta.
      const row = {
        payment_method: 'Efectivo + Pago móvil',
        payments: [
          { method: 'Efectivo', amount: 20 },
          { method: 'Pago móvil', amount: 30 },
        ],
      };
      const isCash = (m: string) => /efectivo|cash|contado/i.test(m);
      const cash = paymentPartsOf(row, 50, num)
        .filter((p) => isCash(p.method))
        .reduce((t, p) => t + p.amount, 0);
      expect(cash).toBe(20); // NO los 50 completos
    });
  });
});
