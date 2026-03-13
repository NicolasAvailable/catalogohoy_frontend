export interface WhatsAppAccount {
  id: number;
  tenantId: number;
  phoneNumber: string;
  displayName: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhatsAppAccountPayload {
  phoneNumber: string;
  displayName: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
}

export interface EmbeddedSignupPayload {
  wabaId: string;
  phoneNumberId: string;
  authCode: string;
}
