import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Order, OrderItem, OrderStatus } from '@catalogohoy/order';
import {
  Client,
  ClientInput,
  ClientList,
  ClientTag,
} from '../domain/client.model';

interface RpcCustomerRow {
  id: number;
  phone: string;
  name: string;
  /** Opcional hasta que el RPC get_customers_by_tenant incluya la columna. */
  nickname?: string | null;
  email: string | null;
  birthday: string | null;
  address: string | null;
  notes: string | null;
  referral_code: string | null;
  tags: ClientTag[] | null;
  total_orders: number;
  total_spent_usd: number;
  total_spent_bs: number;
  avg_order_usd: number;
  first_order_at: string | null;
  last_order_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  /** Últimos 5 mensajes del chat del cliente (match del teléfono por dígitos,
   *  como el cruce de órdenes de la ficha del CRM). Null si no hay chat. */
  async getRecentChatMessages(
    tenantId: number,
    phone: string
  ): Promise<
    E.Either<
      Error,
      {
        chatId: number;
        messages: { content: string; isMine: boolean; createdAt: string }[];
      } | null
    >
  > {
    const target = phone.replace(/\D/g, '');
    if (!target) return E.right(null);

    const { data: chats, error } = await this.client
      .from('chats')
      .select('id, customer_phone')
      .eq('tenant_id', tenantId);
    if (error) return E.left(new Error(error.message));

    const match = (chats ?? []).find((c: { customer_phone: string | null }) => {
      const d = String(c.customer_phone ?? '').replace(/\D/g, '');
      return !!d && (d === target || d.endsWith(target) || target.endsWith(d));
    });
    if (!match) return E.right(null);

    const { data: msgs, error: msgErr } = await this.client
      .from('chat_messages')
      .select('content, is_mine, created_at')
      .eq('chat_id', match.id)
      .not('is_internal', 'is', true)
      .order('created_at', { ascending: false })
      .limit(5);
    if (msgErr) return E.left(new Error(msgErr.message));

    return E.right({
      chatId: match.id,
      messages: (msgs ?? [])
        .reverse()
        .map((m: { content: string; is_mine: boolean; created_at: string }) => ({
          content: m.content,
          isMine: !!m.is_mine,
          createdAt: m.created_at,
        })),
    });
  }

  private readonly client = SupabaseClientProvider.getInstance();

  // ----------------------------------------------------------------- list ---

  async getCustomersByTenant(
    tenantId: number
  ): Promise<E.Either<Error, ClientList>> {
    const { data, error } = await this.client.rpc('get_customers_by_tenant', {
      p_tenant_id: tenantId,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    const items: Client[] = ((data as RpcCustomerRow[]) ?? []).map((row) =>
      this.mapRow(row)
    );

    return E.right({ items });
  }

  private mapRow(row: RpcCustomerRow): Client {
    return {
      id: row.id,
      phone: row.phone,
      name: row.name,
      nickname: row.nickname ?? null,
      email: row.email ?? null,
      birthday: row.birthday ?? null,
      address: row.address ?? null,
      notes: row.notes ?? null,
      referralCode: row.referral_code ?? null,
      tags: Array.isArray(row.tags) ? row.tags : [],
      totalOrders: Number(row.total_orders),
      totalSpentUsd: Number(row.total_spent_usd),
      totalSpentBs: Number(row.total_spent_bs),
      avgOrderUsd: Number(row.avg_order_usd),
      firstOrderAt: row.first_order_at ?? null,
      lastOrderAt: row.last_order_at ?? null,
    };
  }

  // -------------------------------------------------------------- customers ---

  /** Create a customer manually. Returns the new customer id. */
  async createCustomer(
    tenantId: number,
    input: ClientInput
  ): Promise<E.Either<Error, number>> {
    const { data, error } = await this.client
      .from('customers')
      .insert(this.toRow(tenantId, input))
      .select('id')
      .single();

    if (error || !data) {
      return E.left(new Error(error?.message ?? 'No se pudo crear el cliente'));
    }

    const id = data.id as number;
    const assigned = await this.setCustomerTags(id, input.tagIds);
    if (assigned.isLeft()) return E.left(assigned.value);

    return E.right(id);
  }

  /** Update an existing customer and sync its tag assignments. */
  async updateCustomer(
    customerId: number,
    tenantId: number,
    input: ClientInput
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('customers')
      .update({ ...this.toRow(tenantId, input), updated_at: new Date().toISOString() })
      .eq('id', customerId);

    if (error) return E.left(new Error(error.message));

    const assigned = await this.setCustomerTags(customerId, input.tagIds);
    if (assigned.isLeft()) return E.left(assigned.value);

    return E.right(undefined);
  }

  async deleteCustomers(ids: number[]): Promise<E.Either<Error, void>> {
    if (!ids.length) return E.right(undefined);
    const { error } = await this.client.from('customers').delete().in('id', ids);
    return error ? E.left(new Error(error.message)) : E.right(undefined);
  }

  private toRow(tenantId: number, input: ClientInput) {
    const clean = (v: string | null) => {
      const t = (v ?? '').trim();
      return t.length ? t : null;
    };
    return {
      tenant_id: tenantId,
      name: input.name.trim() || 'Cliente',
      nickname: clean(input.nickname),
      phone: input.phone.trim(),
      email: clean(input.email),
      birthday: clean(input.birthday),
      address: clean(input.address),
      notes: clean(input.notes),
      referral_code: clean(input.referralCode),
    };
  }

  // ------------------------------------------------------------------- tags ---

  async listTags(tenantId: number): Promise<E.Either<Error, ClientTag[]>> {
    const { data, error } = await this.client
      .from('customer_tags')
      .select('id, name, color')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) return E.left(new Error(error.message));
    return E.right(
      (data ?? []).map((t: Record<string, unknown>) => ({
        id: t['id'] as number,
        name: t['name'] as string,
        color: t['color'] as string,
      }))
    );
  }

  async createTag(
    tenantId: number,
    name: string,
    color: string
  ): Promise<E.Either<Error, ClientTag>> {
    const { data, error } = await this.client
      .from('customer_tags')
      .insert({ tenant_id: tenantId, name: name.trim(), color })
      .select('id, name, color')
      .single();

    if (error || !data) {
      return E.left(new Error(error?.message ?? 'No se pudo crear la etiqueta'));
    }
    return E.right({
      id: data.id as number,
      name: data.name as string,
      color: data.color as string,
    });
  }

  async updateTag(
    tagId: number,
    name: string,
    color: string
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('customer_tags')
      .update({ name: name.trim(), color })
      .eq('id', tagId);
    return error ? E.left(new Error(error.message)) : E.right(undefined);
  }

  async deleteTag(tagId: number): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('customer_tags')
      .delete()
      .eq('id', tagId);
    return error ? E.left(new Error(error.message)) : E.right(undefined);
  }

  // ------------------------------------------------------------ assignments ---

  /** Replace the full tag set of a customer with `tagIds`. */
  async setCustomerTags(
    customerId: number,
    tagIds: number[]
  ): Promise<E.Either<Error, void>> {
    const { error: delErr } = await this.client
      .from('customer_tag_links')
      .delete()
      .eq('customer_id', customerId);
    if (delErr) return E.left(new Error(delErr.message));

    if (!tagIds.length) return E.right(undefined);

    const rows = tagIds.map((tag_id) => ({ customer_id: customerId, tag_id }));
    const { error: insErr } = await this.client
      .from('customer_tag_links')
      .insert(rows);
    return insErr ? E.left(new Error(insErr.message)) : E.right(undefined);
  }

  /** Remove a single tag from a single customer. */
  async unassignTag(
    customerId: number,
    tagId: number
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('customer_tag_links')
      .delete()
      .eq('customer_id', customerId)
      .eq('tag_id', tagId);
    return error ? E.left(new Error(error.message)) : E.right(undefined);
  }

  /** Assign a single tag to many customers (idempotent). */
  async assignTagToCustomers(
    tagId: number,
    customerIds: number[]
  ): Promise<E.Either<Error, void>> {
    if (!customerIds.length) return E.right(undefined);
    const rows = customerIds.map((customer_id) => ({
      customer_id,
      tag_id: tagId,
    }));
    const { error } = await this.client
      .from('customer_tag_links')
      .upsert(rows, { onConflict: 'customer_id,tag_id', ignoreDuplicates: true });
    return error ? E.left(new Error(error.message)) : E.right(undefined);
  }

  // ----------------------------------------------------------------- orders ---

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
      deliveryDate:
        (e['delivery_date'] as string | null) ?? (e['created_at'] as string),
    }));

    return E.right(orders);
  }
}
