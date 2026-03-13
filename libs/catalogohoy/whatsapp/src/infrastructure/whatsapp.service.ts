import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import {
  CreateWhatsAppAccountPayload,
  WhatsAppAccount,
  WhatsAppAccountMapper,
} from '../domain';

@Injectable({
  providedIn: 'root',
})
export class WhatsAppService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getAccountsByTenant(
    tenantId: number
  ): Promise<E.Either<Error, WhatsAppAccount[]>> {
    const { data, error } = await this.client
      .from('whatsapp_accounts')
      .select(
        'id, tenant_id, phone_number, display_name, waba_id, phone_number_id, status, created_at, updated_at'
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(WhatsAppAccountMapper.toDomainList(data || []));
  }

  async createAccount(
    tenantId: number,
    payload: CreateWhatsAppAccountPayload
  ): Promise<E.Either<Error, WhatsAppAccount>> {
    const { data, error } = await this.client
      .from('whatsapp_accounts')
      .insert({
        tenant_id: tenantId,
        phone_number: payload.phoneNumber,
        display_name: payload.displayName,
        waba_id: payload.wabaId,
        phone_number_id: payload.phoneNumberId,
        status: 'active',
      })
      .select(
        'id, tenant_id, phone_number, display_name, waba_id, phone_number_id, status, created_at, updated_at'
      )
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(WhatsAppAccountMapper.toDomain(data));
  }

  async updateAccount(
    id: number,
    payload: Partial<CreateWhatsAppAccountPayload> & { status?: 'active' | 'inactive' }
  ): Promise<E.Either<Error, WhatsAppAccount>> {
    const updateData: Record<string, unknown> = {};

    if (payload.phoneNumber !== undefined) updateData['phone_number'] = payload.phoneNumber;
    if (payload.displayName !== undefined) updateData['display_name'] = payload.displayName;
    if (payload.wabaId !== undefined) updateData['waba_id'] = payload.wabaId;
    if (payload.phoneNumberId !== undefined) updateData['phone_number_id'] = payload.phoneNumberId;
    if (payload.status !== undefined) updateData['status'] = payload.status;

    updateData['updated_at'] = new Date().toISOString();

    const { data, error } = await this.client
      .from('whatsapp_accounts')
      .update(updateData)
      .eq('id', id)
      .select(
        'id, tenant_id, phone_number, display_name, waba_id, phone_number_id, status, created_at, updated_at'
      )
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(WhatsAppAccountMapper.toDomain(data));
  }

  async deleteAccount(id: number): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('whatsapp_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }
}
