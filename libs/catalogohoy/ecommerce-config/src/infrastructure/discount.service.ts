import { Injectable } from '@angular/core';
import { E } from '../../../../shared/domain/src';
import { SupabaseClientProvider } from '../../../core/src';
import { BogoBuy, BogoGet, DiscountRule, DiscountType, DiscountValueType } from '../domain';

/** CRUD over the `tenant_discounts` table. RLS scopes every row to the tenant's
 *  members (see migration 20260619_discounts_system). The public storefront
 *  never touches this service — it reads automatic rules from the catalog RPC
 *  and validates codes via `validate_discount_code`. */
@Injectable({ providedIn: 'root' })
export class DiscountService {
  private readonly client = SupabaseClientProvider.getInstance();

  async list(tenantId: string): Promise<E.Either<Error, DiscountRule[]>> {
    const { data, error } = await this.client
      .from('tenant_discounts')
      .select('*')
      .eq('tenant_id', Number(tenantId))
      .order('position', { ascending: true });

    if (error) return E.left(new Error(error.message));
    return E.right((data ?? []).map((row) => this.toDomain(row)));
  }

  async create(
    tenantId: string,
    rule: DiscountRule
  ): Promise<E.Either<Error, DiscountRule>> {
    const { data, error } = await this.client
      .from('tenant_discounts')
      .insert(this.toRow(tenantId, rule))
      .select('*')
      .single();

    if (error) return E.left(new Error(error.message));
    return E.right(this.toDomain(data));
  }

  async update(
    id: number,
    rule: DiscountRule
  ): Promise<E.Either<Error, DiscountRule>> {
    const row = this.toRow(null, rule);
    delete row['tenant_id'];
    row['updated_at'] = new Date().toISOString();

    const { data, error } = await this.client
      .from('tenant_discounts')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return E.left(new Error(error.message));
    return E.right(this.toDomain(data));
  }

  async remove(id: number): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('tenant_discounts')
      .delete()
      .eq('id', id);

    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  async setActive(
    id: number,
    isActive: boolean
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('tenant_discounts')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  // ------------------------------------------------------------- mappers ---

  private toRow(
    tenantId: string | null,
    r: DiscountRule
  ): Record<string, unknown> {
    const row: Record<string, unknown> = {
      name: r.name?.trim() || 'Descuento',
      type: r.type,
      code: r.type === 'code' ? r.code?.trim() || null : null,
      value_type: r.valueType,
      value: r.value ?? 0,
      min_order: r.minOrder ?? 0,
      min_items: r.minItems ?? 0,
      free_shipping: r.freeShipping ?? false,
      bogo_buy: r.type === 'bogo' ? r.bogoBuy : null,
      bogo_get: r.type === 'bogo' ? r.bogoGet : null,
      usage_limit: r.usageLimit ?? null,
      starts_at: r.startsAt,
      ends_at: r.endsAt,
      is_active: r.isActive ?? true,
      position: r.position ?? 0,
    };
    if (tenantId !== null) row['tenant_id'] = Number(tenantId);
    return row;
  }

  private toDomain(row: any): DiscountRule {
    return {
      id: row.id ?? null,
      name: row.name ?? '',
      type: (row.type as DiscountType) ?? 'automatic',
      code: row.code ?? null,
      valueType: (row.value_type as DiscountValueType) ?? null,
      value: Number(row.value) || 0,
      minOrder: Number(row.min_order) || 0,
      minItems: Number(row.min_items) || 0,
      freeShipping: row.free_shipping ?? false,
      bogoBuy: (row.bogo_buy as BogoBuy) ?? null,
      bogoGet: (row.bogo_get as BogoGet) ?? null,
      usageLimit: row.usage_limit ?? null,
      usageCount: Number(row.usage_count) || 0,
      startsAt: row.starts_at ?? null,
      endsAt: row.ends_at ?? null,
      isActive: row.is_active ?? true,
      position: Number(row.position) || 0,
    };
  }
}
