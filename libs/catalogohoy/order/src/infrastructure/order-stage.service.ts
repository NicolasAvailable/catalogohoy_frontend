import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { OrderStage, OrderStatus } from '../domain';

export interface SaveOrderStageInput {
  label: string;
  color: string;
  baseStatus: OrderStatus;
}

/** CRUD de los estados de orden propios de la tienda (`order_stages`). */
@Injectable({ providedIn: 'root' })
export class OrderStageService {
  private readonly client = SupabaseClientProvider.getInstance();

  async list(tenantId: number): Promise<E.Either<Error, OrderStage[]>> {
    const { data, error } = await this.client
      .from('order_stages')
      .select('id, tenant_id, label, color, base_status, position')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) return E.left(new Error(error.message));
    return E.right((data ?? []).map(OrderStageService.toDomain));
  }

  async create(
    tenantId: number,
    input: SaveOrderStageInput,
    position: number
  ): Promise<E.Either<Error, OrderStage>> {
    const { data, error } = await this.client
      .from('order_stages')
      .insert({
        tenant_id: tenantId,
        label: input.label.trim(),
        color: input.color,
        base_status: input.baseStatus,
        position,
      })
      .select('id, tenant_id, label, color, base_status, position')
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(OrderStageService.toDomain(data));
  }

  async update(
    tenantId: number,
    id: string,
    input: SaveOrderStageInput
  ): Promise<E.Either<Error, OrderStage>> {
    const { data, error } = await this.client
      .from('order_stages')
      .update({
        label: input.label.trim(),
        color: input.color,
        base_status: input.baseStatus,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, tenant_id, label, color, base_status, position')
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(OrderStageService.toDomain(data));
  }

  /** Guarda el nuevo orden (posición = índice en `ids`). */
  async reorder(tenantId: number, ids: string[]): Promise<E.Either<Error, void>> {
    const results = await Promise.all(
      ids.map((id, position) =>
        this.client
          .from('order_stages')
          .update({ position })
          .eq('id', id)
          .eq('tenant_id', tenantId)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return E.left(new Error(failed.error.message));
    return E.right(undefined);
  }

  /** Borra el estado. Sus órdenes quedan en su estado base (FK ON DELETE SET NULL). */
  async remove(tenantId: number, id: string): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('order_stages')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  /** Cuántas órdenes están hoy en este estado (para avisar antes de borrar o
   *  de cambiarle el comportamiento). */
  async countOrders(tenantId: number, id: string): Promise<number> {
    const { count } = await this.client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('stage_id', id);
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
    };
  }
}
