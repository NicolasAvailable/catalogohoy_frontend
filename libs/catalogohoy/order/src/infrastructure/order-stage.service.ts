import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { OrderStage, OrderStatus, OrderStatusDef } from '../domain';

const COLUMNS =
  'id, tenant_id, label, color, base_status, position, is_hidden, system_status';

/** Estados de orden de la tienda (`order_stages`): personalización de los
 *  estados base + estados propios. */
@Injectable({ providedIn: 'root' })
export class OrderStageService {
  private readonly client = SupabaseClientProvider.getInstance();

  async list(tenantId: number): Promise<E.Either<Error, OrderStage[]>> {
    const { data, error } = await this.client
      .from('order_stages')
      .select(COLUMNS)
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) return E.left(new Error(error.message));
    return E.right((data ?? []).map(OrderStageService.toDomain));
  }

  /** Guarda la lista completa tal como quedó en el editor: la posición es el
   *  índice en `defs`. Los estados base se guardan como filas `system_status`
   *  (solo nombre/color/orden/oculto), los nuevos se insertan y `deletedIds`
   *  se borran (sus órdenes quedan en el estado base, FK SET NULL). */
  async saveAll(
    tenantId: number,
    defs: OrderStatusDef[],
    deletedIds: string[]
  ): Promise<E.Either<Error, void>> {
    if (deletedIds.length) {
      const { error } = await this.client
        .from('order_stages')
        .delete()
        .eq('tenant_id', tenantId)
        .is('system_status', null)
        .in('id', deletedIds);
      if (error) return E.left(new Error(error.message));
    }

    for (const [position, def] of defs.entries()) {
      const row = {
        label: def.label.trim(),
        color: def.color,
        base_status: def.baseStatus,
        position,
        is_hidden: def.system && def.baseStatus === 'pending' ? false : def.hidden,
      };
      const { error } = def.rowId
        ? await this.client
            .from('order_stages')
            .update(row)
            .eq('id', def.rowId)
            .eq('tenant_id', tenantId)
        : await this.client.from('order_stages').insert({
            ...row,
            tenant_id: tenantId,
            system_status: def.system ? def.baseStatus : null,
          });
      if (error) return E.left(new Error(error.message));
    }
    return E.right(undefined);
  }

  /** Cuántas órdenes hay hoy en un estado propio. */
  async countOrders(tenantId: number, stageId: string): Promise<number> {
    const { count } = await this.client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('stage_id', stageId);
    return count ?? 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static toDomain(row: any): OrderStage {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      label: row.label,
      color: row.color,
      baseStatus: row.base_status as OrderStatus,
      position: row.position ?? 0,
      hidden: !!row.is_hidden,
      systemStatus: (row.system_status as OrderStatus | null) ?? null,
    };
  }
}
