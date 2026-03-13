export type BillingPeriod = 'monthly' | 'quarterly' | 'annual';
export type PaymentCurrency = 'usd' | 'ves';

/** Base monthly price per plan per currency */
export const PLAN_BASE_PRICES: Record<PaymentCurrency, Record<string, number>> = {
  usd: { basico: 11.99, avanzado: 23.99 },
  ves: { basico: 14.99, avanzado: 29.99 },
};

/** Catalog addon monthly price per currency */
export const CATALOG_ADDON_PRICE_BY_CURRENCY: Record<PaymentCurrency, number> = {
  usd: 5.99,
  ves: 6.99,
};

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
