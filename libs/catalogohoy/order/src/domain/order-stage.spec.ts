import {
  buildStatusOptions,
  OrderStage,
  resolveStatusKey,
  statusKeyOf,
} from './order-stage';

const stage = (id: string, baseStatus: OrderStage['baseStatus'], position: number): OrderStage => ({
  id,
  tenantId: 1,
  label: id,
  color: '#8b5cf6',
  baseStatus,
  position,
});

describe('order stages', () => {
  const despacho = stage('despacho', 'pending', 1);
  const revision = stage('revision', 'pending', 0);
  const stages = [despacho, revision];

  it('ordena: Pendiente, propios por posición, Completada, A crédito, Cancelada', () => {
    expect(buildStatusOptions(stages).map((o) => o.value)).toEqual([
      'pending',
      'stage:revision',
      'stage:despacho',
      'completed',
      'credit',
      'cancelled',
    ]);
  });

  it('muestra el estado propio solo si coincide con el status', () => {
    expect(statusKeyOf({ status: 'pending', stageId: 'despacho' }, stages)).toBe('stage:despacho');
    expect(statusKeyOf({ status: 'completed', stageId: 'despacho' }, stages)).toBe('completed');
    expect(statusKeyOf({ status: 'pending', stageId: 'borrado' }, stages)).toBe('pending');
    expect(statusKeyOf({ status: 'credit' }, stages)).toBe('credit');
  });

  it('resuelve la clave al status base + stage', () => {
    expect(resolveStatusKey('stage:despacho', stages)).toEqual({ status: 'pending', stageId: 'despacho' });
    expect(resolveStatusKey('completed', stages)).toEqual({ status: 'completed', stageId: null });
    expect(resolveStatusKey('stage:borrado', stages)).toBeNull();
  });
});
