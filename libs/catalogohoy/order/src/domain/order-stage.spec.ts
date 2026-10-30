import {
  behaviorOf,
  buildStatusDefs,
  OrderStage,
  resolveStatusKey,
  statusFromBehavior,
  statusKeyOf,
  toggleBehavior,
} from './order-stage';

const row = (
  id: string,
  baseStatus: OrderStage['baseStatus'],
  position: number,
  extra: Partial<OrderStage> = {}
): OrderStage => ({
  id,
  tenantId: 1,
  label: id,
  color: '#8b5cf6',
  baseStatus,
  position,
  hidden: false,
  systemStatus: null,
  ...extra,
});

describe('order stages', () => {
  const despacho = row('despacho', 'pending', 1);
  const revision = row('revision', 'pending', 0);
  const rows = [despacho, revision];

  it('sin personalizar: Pendiente, propios por posición, Completada, A crédito, Cancelada', () => {
    expect(buildStatusDefs(rows).map((d) => d.key)).toEqual([
      'pending',
      'stage:revision',
      'stage:despacho',
      'completed',
      'credit',
      'cancelled',
    ]);
  });

  it('los base usan su personalización (nombre, oculto, posición)', () => {
    const defs = buildStatusDefs([
      row('s1', 'completed', 0, { systemStatus: 'completed', label: 'Entregada', hidden: true }),
      row('s2', 'pending', 5, { systemStatus: 'pending', hidden: true }),
      row('x', 'pending', 3),
    ]);
    const completed = defs.find((d) => d.key === 'completed')!;
    expect(completed.label).toBe('Entregada');
    expect(completed.hidden).toBe(true);
    expect(completed.rowId).toBe('s1');
    // Pendiente nunca queda oculto.
    expect(defs.find((d) => d.key === 'pending')!.hidden).toBe(false);
    // Las filas de sistema no aparecen como estados propios.
    expect(defs.filter((d) => !d.system).map((d) => d.key)).toEqual(['stage:x']);
    expect(defs[0].key).toBe('completed');
  });

  it('statusKeyOf usa el estado propio solo si coincide con el status', () => {
    const defs = buildStatusDefs(rows);
    expect(statusKeyOf({ status: 'pending', stageId: 'despacho' }, defs)).toBe('stage:despacho');
    expect(statusKeyOf({ status: 'completed', stageId: 'despacho' }, defs)).toBe('completed');
    expect(statusKeyOf({ status: 'pending', stageId: 'borrado' }, defs)).toBe('pending');
    expect(statusKeyOf({ status: 'credit', stageId: null }, defs)).toBe('credit');
  });

  it('resolveStatusKey traduce la clave a status + stageId', () => {
    const defs = buildStatusDefs(rows);
    expect(resolveStatusKey('stage:revision', defs)).toEqual({ status: 'pending', stageId: 'revision' });
    expect(resolveStatusKey('cancelled', defs)).toEqual({ status: 'cancelled', stageId: null });
    expect(resolveStatusKey('stage:nope', defs)).toBeNull();
  });

  it('los checks de comportamiento son escalonados', () => {
    expect(behaviorOf('pending')).toEqual({ countsAsSale: true, deductsStock: false, paid: false });
    expect(statusFromBehavior(behaviorOf('credit'))).toBe('credit');

    const pending = behaviorOf('pending');
    expect(statusFromBehavior(toggleBehavior(pending, 'paid', true))).toBe('completed');
    expect(statusFromBehavior(toggleBehavior(pending, 'deductsStock', true))).toBe('credit');
    expect(statusFromBehavior(toggleBehavior(pending, 'countsAsSale', false))).toBe('cancelled');
    expect(statusFromBehavior(toggleBehavior(behaviorOf('completed'), 'deductsStock', false))).toBe('pending');
  });
});
