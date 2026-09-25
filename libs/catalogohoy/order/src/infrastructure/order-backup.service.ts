import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import { OrderBackup } from '../domain';

/** Respaldos (snapshots) de las órdenes del tenant — tabla `order_backups` +
 *  RPCs `create_order_backup` / `restore_order_backup`. A diferencia de
 *  productos, el import de órdenes no es destructivo, así que el respaldo se crea
 *  a demanda ("Crear respaldo ahora") y antes de restaurar. Restaurar es
 *  APPEND-ONLY: repone solo las órdenes borradas, sin pisar las actuales. */
@Injectable({ providedIn: 'root' })
export class OrderBackupService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);

  /** Crea un snapshot de todas las órdenes actuales del tenant. Devuelve el id. */
  public async createBackup(
    reason = 'manual'
  ): Promise<E.Either<Error, number>> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return E.left(new Error('No tenant'));

    const { data, error } = await this.client.rpc('create_order_backup', {
      p_tenant_id: tenantId,
      p_reason: reason,
    });
    if (error) return E.left(new Error(error.message));
    return E.right(data as number);
  }

  /** Lista los respaldos del tenant (más recientes primero). */
  public async listBackups(): Promise<E.Either<Error, OrderBackup[]>> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return E.right([]);

    const { data, error } = await this.client
      .from('order_backups')
      .select('id, created_at, reason, order_count')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) return E.left(new Error(error.message));

    return E.right(
      (data ?? []).map((r) => ({
        id: r.id as number,
        createdAt: r.created_at as string,
        reason: r.reason as string,
        orderCount: r.order_count as number,
      }))
    );
  }

  /** Trae el snapshot (array de órdenes crudas, snake_case) de un respaldo. */
  public async getSnapshot(
    backupId: number
  ): Promise<E.Either<Error, unknown[]>> {
    const { data, error } = await this.client
      .from('order_backups')
      .select('snapshot')
      .eq('id', backupId)
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right((data?.snapshot ?? []) as unknown[]);
  }

  /** Restaura APPEND-ONLY: repone las órdenes del respaldo que ya no existen
   *  (borradas). Devuelve cuántas se recuperaron. No pisa ni borra las actuales. */
  public async restoreBackup(
    backupId: number
  ): Promise<E.Either<Error, number>> {
    const { data, error } = await this.client.rpc('restore_order_backup', {
      p_backup_id: backupId,
    });
    if (error) return E.left(new Error(error.message));
    return E.right((data as number) ?? 0);
  }
}
