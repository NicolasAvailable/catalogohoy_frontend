import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import { ProductBackup, ProductBackupSnapshotRow } from '../domain';

/** Backups (snapshots) de los productos del tenant. Se crean antes de un import
 *  para poder descargar/restaurar la versión anterior (tabla `product_backups`
 *  + RPC `create_product_backup`). */
@Injectable({ providedIn: 'root' })
export class ProductBackupService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);

  /** Crea un snapshot de los productos actuales del tenant. Devuelve el id. */
  public async createBackup(
    reason = 'import'
  ): Promise<E.Either<Error, number>> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return E.left(new Error('No tenant'));

    const { data, error } = await this.client.rpc('create_product_backup', {
      p_tenant_id: tenantId,
      p_reason: reason,
    });
    if (error) return E.left(new Error(error.message));
    return E.right(data as number);
  }

  /** Lista los backups del tenant (más recientes primero). */
  public async listBackups(): Promise<E.Either<Error, ProductBackup[]>> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return E.right([]);

    const { data, error } = await this.client
      .from('product_backups')
      .select('id, created_at, reason, product_count')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) return E.left(new Error(error.message));

    return E.right(
      (data ?? []).map((r) => ({
        id: r.id as number,
        createdAt: r.created_at as string,
        reason: r.reason as string,
        productCount: r.product_count as number,
      }))
    );
  }

  /** Trae el snapshot (array de productos) de un backup. */
  public async getSnapshot(
    backupId: number
  ): Promise<E.Either<Error, ProductBackupSnapshotRow[]>> {
    const { data, error } = await this.client
      .from('product_backups')
      .select('snapshot')
      .eq('id', backupId)
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right((data?.snapshot ?? []) as ProductBackupSnapshotRow[]);
  }
}
