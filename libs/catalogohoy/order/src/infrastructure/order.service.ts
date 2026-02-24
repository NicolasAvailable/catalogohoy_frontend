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
  totalBs: number;
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
        total_bs: input.totalBs,
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
        total_bs: input.totalBs,
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

  async updateOrderStatus(
    id: number,
    tenantId: number,
    oldStatus: OrderStatus,
    newStatus: OrderStatus
  ): Promise<E.Either<Error, Order>> {
    const { data: order, error: fetchError } = await this.client
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError) {
      return E.left(new Error(fetchError.message));
    }

    const { data, error } = await this.client
      .from('orders')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    const products = Array.isArray(order.products) ? order.products : [];

    // Cancelling → restore stock
    if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
      await this.restoreStock(products);
    }

    // Un-cancelling → deduct stock
    if (oldStatus === 'cancelled' && newStatus !== 'cancelled') {
      await this.deductStock(products);
    }

    return E.right(OrderMapper.toDomain(data));
  }

  async cancelOrder(
    id: number,
    tenantId: number
  ): Promise<E.Either<Error, Order>> {
    return this.updateOrderStatus(id, tenantId, 'pending', 'cancelled');
  }

  private async restoreStock(
    products: { productId: string; quantity?: number }[]
  ): Promise<void> {
    for (const item of products) {
      const { data: product } = await this.client
        .from('products')
        .select('stock')
        .eq('id', item.productId)
        .single();

      if (product && product.stock !== null) {
        const currentStock = Number(product.stock);
        const restoredStock = currentStock + (item.quantity ?? 0);
        await this.client
          .from('products')
          .update({ stock: restoredStock })
          .eq('id', item.productId);
      }
    }
  }

  private async deductStock(
    products: { productId: string; quantity?: number }[]
  ): Promise<void> {
    for (const item of products) {
      const { data: product } = await this.client
        .from('products')
        .select('stock')
        .eq('id', item.productId)
        .single();

      if (product && product.stock !== null) {
        const currentStock = Number(product.stock);
        const newStock = Math.max(0, currentStock - (item.quantity ?? 0));
        await this.client
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.productId);
      }
    }
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
