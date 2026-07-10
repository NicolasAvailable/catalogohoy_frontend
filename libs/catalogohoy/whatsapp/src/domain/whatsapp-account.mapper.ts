import { WhatsAppAccount } from './whatsapp-account';

export class WhatsAppAccountMapper {
  static toDomain(raw: Record<string, unknown>): WhatsAppAccount {
    return {
      id: raw['id'] as number,
      tenantId: raw['tenant_id'] as number,
      phoneNumber: raw['phone_number'] as string,
      displayName: raw['display_name'] as string | null,
      wabaId: raw['waba_id'] as string | null,
      phoneNumberId: raw['phone_number_id'] as string | null,
      status: raw['status'] as 'active' | 'inactive',
      createdAt: raw['created_at'] as string,
      updatedAt: raw['updated_at'] as string,
    };
  }

  static toDomainList(raw: Record<string, unknown>[]): WhatsAppAccount[] {
    return raw.map(WhatsAppAccountMapper.toDomain);
  }
}
