import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Order, OrderMapper } from '../domain';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getOrdersByTenant(
    tenantId: number,
    options?: { date?: Date; search?: string }
  ): Promise<E.Either<Error, Order[]>> {
    let query = this.client
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId);

    // Filter by date if provided
    if (options?.date) {
      const startOfDay = new Date(options.date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(options.date);
      endOfDay.setHours(23, 59, 59, 999);

      query = query
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', endOfDay.toISOString());
    }

    // Filter by search query (search in name field)
    if (options?.search?.trim()) {
      query = query.ilike('name', `%${options.search.trim()}%`);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(OrderMapper.toDomainList(data || []));
  }
}
