import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Order, OrderItem, OrderMapper, OrderStatus } from '../domain';

export interface CreateOrderInput {
  name: string;
  phone?: string;
  comments?: string;
  status: OrderStatus;
  products: OrderItem[];
  totalUsd: number;
  tenantId: number;
}

export interface UpdateOrderInput extends CreateOrderInput {
  id: number;
}

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

  async getOrderById(
    id: number,
    tenantId: number
  ): Promise<E.Either<Error, Order>> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(OrderMapper.toDomain(data));
  }

  async createOrder(input: CreateOrderInput): Promise<E.Either<Error, Order>> {
    const { data, error } = await this.client
      .from('orders')
      .insert({
        name: input.name,
        phone: input.phone,
        comments: input.comments,
        status: input.status,
        products: input.products,
        total_usd: input.totalUsd,
        tenant_id: input.tenantId,
      })
      .select()
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(OrderMapper.toDomain(data));
  }

  async updateOrder(input: UpdateOrderInput): Promise<E.Either<Error, Order>> {
    const { data, error } = await this.client
      .from('orders')
      .update({
        name: input.name,
        phone: input.phone,
        comments: input.comments,
        status: input.status,
        products: input.products,
        total_usd: input.totalUsd,
      })
      .eq('id', input.id)
      .eq('tenant_id', input.tenantId)
      .select()
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(OrderMapper.toDomain(data));
  }

  async deleteOrder(
    id: number,
    tenantId: number
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('orders')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }
}
