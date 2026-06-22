import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { PlatformOrder, PlatformOrderStats } from './platform-orders.model';

@Injectable({ providedIn: 'root' })
export class PlatformOrdersService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getStats(): Promise<Either<Error, PlatformOrderStats>> {
    const { data, error } = await this.client.rpc(
      'platform_orders_stats_admin'
    );
    if (error) return E.left(new Error(error.message));
    return E.right(data as PlatformOrderStats);
  }

  async listOrders(limit = 200): Promise<Either<Error, PlatformOrder[]>> {
    const { data, error } = await this.client.rpc('list_platform_orders_admin', {
      p_limit: limit,
    });
    if (error) return E.left(new Error(error.message));
    const rows = (data ?? []) as Record<string, unknown>[];
    return E.right(
      rows.map((r) => ({
        id: Number(r['id']),
        orderNumber:
          r['order_number'] == null ? null : Number(r['order_number']),
        tenantName: (r['tenant_name'] as string) ?? null,
        tenantSlug: (r['tenant_slug'] as string) ?? null,
        customerName: (r['customer_name'] as string) ?? null,
        phone: (r['phone'] as string) ?? null,
        status: (r['status'] as PlatformOrder['status']) ?? 'pending',
        totalUsd: Number(r['total_usd'] ?? 0),
        totalBs: Number(r['total_bs'] ?? 0),
        itemCount: Number(r['item_count'] ?? 0),
        createdAt: r['created_at'] as string,
      }))
    );
  }
}
