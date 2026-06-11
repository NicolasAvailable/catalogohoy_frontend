import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Order, OrderItem, OrderStatus } from '@catalogohoy/order';
import { Client, ClientList } from '../domain/client.model';

interface RpcCustomerRow {
  phone: string;
  name: string;
  total_orders: number;
  total_spent_usd: number;
  total_spent_bs: number;
  avg_order_usd: number;
  first_order_at: string;
  last_order_at: string;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getCustomersByTenant(
    tenantId: number
  ): Promise<E.Either<Error, ClientList>> {
    const { data, error } = await this.client.rpc('get_customers_by_tenant', {
      p_tenant_id: tenantId,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    // The aggregate RPC doesn't expose email, so resolve it separately from the
    // orders table (most recent non-null email per phone). Kept client-side to
    // avoid touching the prod RPC's return signature.
    const emailByPhone = await this.getLatestEmailByPhone(tenantId);

    const items: Client[] = ((data as RpcCustomerRow[]) ?? []).map((row) => ({
      phone: row.phone,
      name: row.name,
      email: emailByPhone.get(row.phone) ?? null,
      totalOrders: Number(row.total_orders),
      totalSpentUsd: Number(row.total_spent_usd),
      totalSpentBs: Number(row.total_spent_bs),
      avgOrderUsd: Number(row.avg_order_usd),
      firstOrderAt: row.first_order_at,
      lastOrderAt: row.last_order_at,
    }));

    return E.right({ items });
  }

  /** Map of phone → most recent non-empty email, from this tenant's orders. */
  private async getLatestEmailByPhone(
    tenantId: number
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const { data, error } = await this.client
      .from('orders')
      .select('phone, email, created_at')
      .eq('tenant_id', tenantId)
      .not('email', 'is', null)
      .order('created_at', { ascending: false });

    if (error || !data) return map;

    for (const row of data as { phone: string | null; email: string | null }[]) {
      const phone = row.phone?.trim();
      const email = row.email?.trim();
      // Rows are newest-first, so the first email seen per phone is the latest.
      if (phone && email && !map.has(phone)) map.set(phone, email);
    }
    return map;
  }

  async getOrdersByPhone(
    tenantId: number,
    phone: string
  ): Promise<E.Either<Error, Order[]>> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .order('created_at', { ascending: false });

    if (error) {
      return E.left(new Error(error.message));
    }

    const orders: Order[] = (data ?? []).map((e: Record<string, unknown>) => ({
      id: e['id'] as number,
      name: e['name'] as string,
      products: Array.isArray(e['products'])
        ? (e['products'] as OrderItem[])
        : [],
      status: e['status'] as OrderStatus,
      tenantId: e['tenant_id'] as number,
      totalUsd: e['total_usd'] as number,
      totalBs: e['total_bs'] as number | undefined,
      createdAt: e['created_at'] as string,
      updatedAt: e['updated_at'] as string,
      phone: e['phone'] as string | undefined,
      comments: e['comments'] as string | undefined,
      deliveryDate: (e['delivery_date'] as string | null) ?? (e['created_at'] as string),
    }));

    return E.right(orders);
  }
}
