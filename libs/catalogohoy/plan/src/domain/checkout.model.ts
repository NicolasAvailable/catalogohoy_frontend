export type BillingPeriod = 'monthly' | 'quarterly' | 'annual';
export type PaymentCurrency = 'usd';

/** Base monthly price per plan (USD) */
export const PLAN_BASE_PRICES: Record<string, number> = {
  basico: 9.99,
  avanzado: 19.99,
};

/** Catalog addon monthly price (USD) */
export const CATALOG_ADDON_PRICE = 5.99;

export interface CheckoutRequest {
  planId: string;
  billingPeriod: BillingPeriod;
  tenantId: number;
  successUrl: string;
  cancelUrl: string;
  catalogAddonQuantity?: number;
}

export interface CheckoutSession {
  url: string;
}

export interface CatalogCheckoutRequest {
  tenantId: number;
  successUrl: string;
  cancelUrl: string;
}

export interface UpdateCatalogSlotsRequest {
  tenantId: number;
  additionalQuantity: number;
}
