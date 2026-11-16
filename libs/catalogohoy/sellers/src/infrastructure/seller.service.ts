import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import {
  BaseSellerService,
  commissionBase,
  Seller,
  SellerCommissionRow,
  SellerInput,
  SellerOrder,
} from '../domain';

const TABLE = 'sellers';
const COLUMNS = 'id, name, slug, whatsapp, email, commission_pct, is_active, created_at';

/** Vendedores con comisión (`sellers`). RLS: dueño o permiso `vendedores`. */
@Injectable({ providedIn: 'root' })
export class SellerService extends BaseSellerService {
  private readonly client = SupabaseClientProvider.getInstance();

  async list(tenantId: number): Promise<E.Either<Error, Seller[]>> {
    const { data, error } = await this.client
      .from(TABLE)
      .select(COLUMNS)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    if (error) return E.left(new Error(error.message));
    return E.right((data ?? []).map(SellerService.toDomain));
  }

  async create(tenantId: number, input: SellerInput): Promise<E.Either<Error, Seller>> {
    const { data, error } = await this.client
      .from(TABLE)
      .insert({ ...SellerService.toRow(input), tenant_id: tenantId })
      .select(COLUMNS)
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(SellerService.toDomain(data));
  }

  async update(tenantId: number, id: string, input: Partial<SellerInput>): Promise<E.Either<Error, Seller>> {
    const { data, error } = await this.client
      .from(TABLE)
      .update(SellerService.toRow(input))
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(COLUMNS)
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(SellerService.toDomain(data));
  }

  async remove(tenantId: number, id: string): Promise<E.Either<Error, void>> {
    const { error } = await this.client.from(TABLE).delete().eq('id', id).eq('tenant_id', tenantId);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  async commissions(tenantId: number, from: string, to: string): Promise<E.Either<Error, SellerCommissionRow[]>> {
    const { data, error } = await this.client.rpc('get_seller_commissions', {
      p_tenant_id: tenantId,
      p_from: from,
      p_to: to,
    });
    if (error) return E.left(new Error(error.message));
    return E.right(
      ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        sellerId: String(r['seller_id']),
        name: String(r['name'] ?? ''),
        slug: String(r['slug'] ?? ''),
        whatsapp: (r['whatsapp'] as string | null) ?? null,
        commissionPct: Number(r['commission_pct']) || 0,
        isActive: r['is_active'] !== false,
        completedOrders: Number(r['completed_orders']) || 0,
        sales: Number(r['sales']) || 0,
        commission: Number(r['commission']) || 0,
        commissionPaid: Number(r['commission_paid']) || 0,
        commissionPending: Number(r['commission_pending']) || 0,
        openOrders: Number(r['open_orders']) || 0,
        openSales: Number(r['open_sales']) || 0,
      }))
    );
  }

  async orders(tenantId: number, sellerId: string, from: string, to: string): Promise<E.Either<Error, SellerOrder[]>> {
    const { data, error } = await this.client
      .from('orders')
      .select(
        'id, order_number, name, created_at, status, total_usd, shipping_fee, commission, seller_commission_pct, seller_commission_paid_at'
      )
      .eq('tenant_id', tenantId)
      .eq('seller_id', sellerId)
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false });
    if (error) return E.left(new Error(error.message));
    return E.right(
      (data ?? []).map((o) => {
        const base = commissionBase(Number(o.total_usd), Number(o.shipping_fee), Number(o.commission));
        const pct = Number(o.seller_commission_pct) || 0;
        return {
          id: o.id as number,
          orderNumber: (o.order_number as number | null) ?? null,
          customer: (o.name as string) || 'Cliente',
          createdAt: o.created_at as string,
          status: (o.status as string) ?? 'pending',
          base,
          pct,
          commission: o.status === 'completed' ? Math.round(base * pct) / 100 : 0,
          paidAt: (o.seller_commission_paid_at as string | null) ?? null,
        };
      })
    );
  }

  async setPaid(sellerId: string, from: string, to: string, paid: boolean): Promise<E.Either<Error, number>> {
    const { data, error } = await this.client.rpc('set_seller_commissions_paid', {
      p_seller_id: sellerId,
      p_from: from,
      p_to: to,
      p_paid: paid,
    });
    if (error) return E.left(new Error(error.message));
    return E.right(Number(data) || 0);
  }

  private static toRow(input: Partial<SellerInput>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    if (input.name !== undefined) row['name'] = input.name.trim();
    if (input.slug !== undefined) row['slug'] = input.slug;
    if (input.whatsapp !== undefined) row['whatsapp'] = input.whatsapp?.trim() || null;
    if (input.email !== undefined) row['email'] = input.email?.trim() || null;
    if (input.commissionPct !== undefined) row['commission_pct'] = input.commissionPct;
    if (input.isActive !== undefined) row['is_active'] = input.isActive;
    return row;
  }

  private static toDomain(row: Record<string, unknown>): Seller {
    return {
      id: String(row['id']),
      name: String(row['name'] ?? ''),
      slug: String(row['slug'] ?? ''),
      whatsapp: (row['whatsapp'] as string | null) ?? null,
      email: (row['email'] as string | null) ?? null,
      commissionPct: Number(row['commission_pct']) || 0,
      isActive: row['is_active'] !== false,
      createdAt: String(row['created_at'] ?? ''),
    };
  }
}
