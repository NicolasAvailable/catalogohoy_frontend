import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Order, OrderItem, OrderMapper, OrderStatus } from '../domain';

export interface WeekDayData {
  label: string;
  salesBs: number;
  salesUsd: number;
  orders: number;
}

export interface HomeStats {
  todayOrders: number;
  todaySalesUsd: number;
  todaySalesBs: number;
  monthlySalesUsd: number;
  monthlySalesBs: number;
  weeklyData: WeekDayData[];
}

export interface CreateOrderInput {
  name: string;
  phone?: string;
  comments?: string;
  status: OrderStatus;
  products: OrderItem[];
  totalUsd: number;
  totalBs: number;
  tenantId: number;
  /** ISO date "YYYY-MM-DD". If omitted, the DB defaults to CURRENT_DATE. */
  deliveryDate?: string;
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
    const payload: Record<string, unknown> = {
      name: input.name,
      phone: input.phone,
      comments: input.comments,
      status: input.status,
      products: input.products,
      total_usd: input.totalUsd,
      total_bs: input.totalBs,
      tenant_id: input.tenantId,
    };
    if (input.deliveryDate) payload['delivery_date'] = input.deliveryDate;

    const { data, error } = await this.client
      .from('orders')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(OrderMapper.toDomain(data));
  }

  async updateOrder(input: UpdateOrderInput): Promise<E.Either<Error, Order>> {
    const patch: Record<string, unknown> = {
      name: input.name,
      phone: input.phone,
      comments: input.comments,
      status: input.status,
      products: input.products,
      total_usd: input.totalUsd,
      total_bs: input.totalBs,
    };
    if (input.deliveryDate) patch['delivery_date'] = input.deliveryDate;

    const { data, error } = await this.client
      .from('orders')
      .update(patch)
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

  async getHomeStats(tenantId: number): Promise<E.Either<Error, HomeStats>> {
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Weekly data: last 7 days (Mon-Sun or relative)
    const dayLabels = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Hoy'];
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const [todayResult, monthResult, weekResult] = await Promise.all([
      this.client
        .from('orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', endOfDay.toISOString())
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }),
      this.client
        .from('orders')
        .select('total_usd, total_bs')
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfMonth.toISOString())
        .neq('status', 'cancelled'),
      this.client
        .from('orders')
        .select('total_bs, total_usd, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', weekStart.toISOString())
        .neq('status', 'cancelled'),
    ]);

    if (todayResult.error) return E.left(new Error(todayResult.error.message));
    if (monthResult.error) return E.left(new Error(monthResult.error.message));
    if (weekResult.error) return E.left(new Error(weekResult.error.message));

    const todayOrders = OrderMapper.toDomainList(todayResult.data || []);
    const todaySalesUsd = todayOrders.reduce((sum, o) => sum + (o.totalUsd || 0), 0);
    const todaySalesBs = todayOrders.reduce((sum, o) => sum + (o.totalBs || 0), 0);

    const monthData = monthResult.data || [];
    const monthlySalesUsd = monthData.reduce((sum, o) => sum + (o.total_usd || 0), 0);
    const monthlySalesBs = monthData.reduce((sum, o) => sum + (o.total_bs || 0), 0);

    // Group weekly orders by day
    const weeklyData: WeekDayData[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const dayOrders = (weekResult.data || []).filter((o) => {
        const d = new Date(o.created_at);
        return d >= dayStart && d <= dayEnd;
      });

      weeklyData.push({
        label: dayLabels[i],
        salesBs: dayOrders.reduce((sum, o) => sum + (o.total_bs || 0), 0),
        salesUsd: dayOrders.reduce((sum, o) => sum + (o.total_usd || 0), 0),
        orders: dayOrders.length,
      });
    }

    return E.right({
      todayOrders: todayOrders.length,
      todaySalesUsd,
      todaySalesBs,
      monthlySalesUsd,
      monthlySalesBs,
      weeklyData,
    });
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
