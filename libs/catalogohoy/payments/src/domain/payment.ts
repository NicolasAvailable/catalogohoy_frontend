/** Pasarelas soportadas (coincide con el CHECK de tenant_payment_accounts). */
export type PaymentProviderId =
  | 'mercadopago'
  | 'stripe'
  | 'wompi'
  | 'culqi'
  | 'flow';

/** Cómo se conecta la cuenta del comerciante:
 *  - 'api_keys' → el comerciante pega sus credenciales.
 *  - 'oauth'    → un click "Conectar" (mejora futura, ej. Mercado Pago). */
export type PaymentConnectionType = 'oauth' | 'api_keys';

export type PaymentAccountStatus = 'connected' | 'revoked';

/** Estado de pago de una orden (columna orders.payment_status). */
export type OrderPaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed';

/**
 * Cuenta de pasarela conectada por un comerciante. Vista PÚBLICA: los campos
 * secretos (access_token / refresh_token / webhook_secret) NUNCA se exponen al
 * frontend — sólo las edge functions los leen con service_role para cobrar.
 */
export interface PaymentAccount {
  id: number;
  tenantId: number;
  provider: PaymentProviderId;
  connectionType: PaymentConnectionType;
  publicKey: string | null;
  externalAccountId: string | null;
  countryCode: string | null;
  status: PaymentAccountStatus;
  isEnabled: boolean;
  connectedAt: string;
}

/** Credenciales que el comerciante completa al conectar (modo api_keys). */
export interface PaymentCredentialsInput {
  /** Llave pública / publishable (no secreta). */
  publicKey?: string | null;
  /** Llave secreta: sk_ (Stripe) · prv_ (Wompi) · Access Token (Mercado Pago)… */
  secretKey: string;
}
