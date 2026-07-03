import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { ActivityLogService } from '@catalogohoy/teams';
import { E } from '@shared/domain';
import {
  InternalNote,
  Order,
  OrderItem,
  OrderMapper,
  OrderStatus,
} from '../domain';

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
  /** Free-form payment method label (e.g. "Efectivo", "Pago móvil"). Mirrors
   *  the public catalog checkout flow where the customer picks a method
   *  before sending the order via WhatsApp. */
  paymentMethod?: string;
}

export interface UpdateOrderInput extends CreateOrderInput {
  id: number;
}

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly activityLog = inject(ActivityLogService);

  async getOrdersByTenant(
    tenantId: number,
    options?: {
      date?: Date;
      search?: string;
      /** Filter by status ('all' = no filter). */
      status?: OrderStatus | 'all';
      /** 1-based page index. */
      page?: number;
      /** How many rows per page. When omitted, no range is applied (all). */
      pageSize?: number;
      /** 'date_desc' | 'date_asc' | 'total_desc' | 'total_asc'. */
      orderBy?: 'date_desc' | 'date_asc' | 'total_desc' | 'total_asc';
    }
  ): Promise<E.Either<Error, { orders: Order[]; totalCount: number }>> {
    let query = this.client
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Filter by status
    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

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

    // Ordering
    switch (options?.orderBy) {
      case 'date_asc':
        query = query.order('created_at', { ascending: true });
        break;
      case 'total_desc':
        query = query.order('total_usd', { ascending: false });
        break;
      case 'total_asc':
        query = query.order('total_usd', { ascending: true });
        break;
      case 'date_desc':
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Server-side pagination — avoid dragging every row over the wire.
    if (options?.pageSize) {
      const page = options.page && options.page > 0 ? options.page : 1;
      const from = (page - 1) * options.pageSize;
      const to = from + options.pageSize - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right({
      orders: OrderMapper.toDomainList(data || []),
      totalCount: count ?? 0,
    });
  }

  /** Count-only query. Ignores all filters — used for the "total in general"
   *  label shown in the orders list footer. */
  async countOrdersByTenant(
    tenantId: number
  ): Promise<E.Either<Error, number>> {
    const { count, error } = await this.client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (error) return E.left(new Error(error.message));
    return E.right(count ?? 0);
  }

  /** Count of pending (newly arrived, not yet fulfilled) orders. Powers the
   *  real-time badge next to "Ordenes" in the sidebar. `head: true` fetches
   *  no rows — only the server-side count. */
  async countPendingByTenant(
    tenantId: number
  ): Promise<E.Either<Error, number>> {
    const { count, error } = await this.client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending');

    if (error) return E.left(new Error(error.message));
    return E.right(count ?? 0);
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
      // Alta manual desde el admin: los triggers de notificación (WhatsApp/email)
      // saltan cuando source='manual'. Solo el catálogo público notifica.
      source: 'manual',
    };
    if (input.deliveryDate) payload['delivery_date'] = input.deliveryDate;
    if (input.paymentMethod !== undefined) payload['payment_method'] = input.paymentMethod || null;

    const { data, error } = await this.client
      .from('orders')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    this.activityLog.log({
      action: 'order.create',
      entityType: 'order',
      entityId: data.id,
      entityName: `Orden #${data.id} — ${input.name}`,
    });

    return E.right(OrderMapper.toDomain(data));
  }

  async updateOrder(input: UpdateOrderInput): Promise<E.Either<Error, Order>> {
    // Snapshot before for diff
    const { data: before } = await this.client
      .from('orders')
      .select('name, status, delivery_date')
      .eq('id', input.id)
      .single();

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
    if (input.paymentMethod !== undefined) patch['payment_method'] = input.paymentMethod || null;

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

    if (before) {
      const changes = this.activityLog.diff(
        { name: before.name, status: before.status, deliveryDate: before.delivery_date },
        { name: input.name, status: input.status, deliveryDate: input.deliveryDate }
      );
      if (changes.length > 0) {
        this.activityLog.log({
          action: 'order.update',
          entityType: 'order',
          entityId: input.id,
          entityName: `Orden #${input.id} — ${input.name}`,
          changes,
        });
      }
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

    // El stock se mueve únicamente cuando la orden cruza la frontera
    // `completed`. Mientras está pending/cancelled no afecta inventario.
    //   - cualquier estado → completed: descontar
    //   - completed → cualquier otro: restaurar
    if (oldStatus !== 'completed' && newStatus === 'completed') {
      await this.deductStock(tenantId, products);
    } else if (oldStatus === 'completed' && newStatus !== 'completed') {
      await this.restoreStock(tenantId, products);
    }

    this.activityLog.log({
      action: 'order.status',
      entityType: 'order',
      entityId: id,
      entityName: `Orden #${id} — ${order.name}`,
      changes: [{ field: 'status', from: oldStatus, to: newStatus }],
    });

    return E.right(OrderMapper.toDomain(data));
  }

  async cancelOrder(
    id: number,
    tenantId: number
  ): Promise<E.Either<Error, Order>> {
    return this.updateOrderStatus(id, tenantId, 'pending', 'cancelled');
  }

  /** Appends an internal team note to an order's thread (admin-only). */
  async addInternalNote(
    id: number,
    tenantId: number,
    note: InternalNote
  ): Promise<E.Either<Error, Order>> {
    // Re-read the current thread so concurrent edits don't clobber each other.
    const { data: cur, error: fetchError } = await this.client
      .from('orders')
      .select('internal_notes')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (fetchError) return E.left(new Error(fetchError.message));

    const notes = Array.isArray(cur?.internal_notes) ? cur.internal_notes : [];
    notes.push(note);

    const { data, error } = await this.client
      .from('orders')
      .update({ internal_notes: notes })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) return E.left(new Error(error.message));
    return E.right(OrderMapper.toDomain(data));
  }

  /** Restaura stock vía RPC `increment_product_stock` (SECURITY DEFINER).
   *  Soporta productos con sizes — el size se lee de cada item. */
  private async restoreStock(
    tenantId: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[]
  ): Promise<void> {
    if (!items?.length) return;
    const payload = items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity ?? 0,
      size: it.size ?? null,
      variantId: it.variantId ?? null,
    }));
    const { error } = await this.client.rpc('increment_product_stock', {
      p_tenant_id: tenantId,
      p_items: payload,
    });
    if (error) {
      console.warn('[increment_product_stock] failed', error);
    }
  }

  /** Descuenta stock vía RPC `decrement_product_stock` (SECURITY DEFINER).
   *  Soporta productos con sizes — el size se lee de cada item. */
  private async deductStock(
    tenantId: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[]
  ): Promise<void> {
    if (!items?.length) return;
    const payload = items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity ?? 0,
      size: it.size ?? null,
      variantId: it.variantId ?? null,
    }));
    const { error } = await this.client.rpc('decrement_product_stock', {
      p_tenant_id: tenantId,
      p_items: payload,
    });
    if (error) {
      console.warn('[decrement_product_stock] failed', error);
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
