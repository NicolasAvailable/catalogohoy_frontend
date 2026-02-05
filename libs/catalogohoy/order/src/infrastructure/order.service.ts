import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Order, OrderMapper } from '../domain';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getOrdersByTenant(tenantId: number): Promise<E.Either<Error, Order[]>> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(OrderMapper.toDomainList(data || []));
  }
}
