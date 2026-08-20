export type BillingPeriod = 'monthly' | 'quarterly' | 'annual';

// Every currency supported by Stripe multi-currency Prices for our plans.
// Must stay in sync with `FX_RATES` / `SUPPORTED_CURRENCIES` in the
// `setup-plan-currency-options` / `create-checkout-session` edge functions.
export type PaymentCurrency =
  | 'usd' | 'eur' | 'ars' | 'bob' | 'brl' | 'cad' | 'clp' | 'cop' | 'crc'
  | 'dop' | 'gtq' | 'gyd' | 'htg' | 'hnl' | 'jmd' | 'mxn' | 'nio' | 'pen'
  | 'pyg' | 'uyu' | 'bsd' | 'bbd' | 'bzd' | 'srd' | 'ttd';

/** Base monthly price per plan (USD).
 *  ⚠️ Display/gate only — el cobro real sale del PRICE_MAP hardcodeado en la
 *  edge function `create-checkout-session`. Cambios de precio = actualizar
 *  AMBOS y deployarlos juntos.
 *  Nota switch pricing 2026-07: avanzado pasa a 29.99 en el commit del switch
 *  (junto con la fila `pro` en DB + redeploy de la edge function). */
export const PLAN_BASE_PRICES: Record<string, number> = {
  basico: 9.99,
  pro: 19.99,
  avanzado: 29.99,
};

/** Catalog addon monthly price (USD). Mirror this in Stripe — the actual
 *  charge comes from the price IDs configured in the
 *  `create-checkout-session` / `update-catalog-slots` edge functions. */
export const CATALOG_ADDON_PRICE = 4.99;

// Mirrors the Stripe edge function FX_RATES map. Used client-side so the plans
// page can preview the local amount without a Stripe round-trip. Stripe remains
// the source of truth at checkout; these are display-only.
// ARS y BOB usan tasa PARALELA (no oficial): Argentina blue ~1550, Bolivia
// paralelo ~12.5 (2026-07-28). Debe coincidir con los currency_options de
// Stripe (mismos precios del regen batch parallel-freemonth). Revisar si el
// paralelo se mueve mucho.
export const CHECKOUT_FX_RATES: Record<PaymentCurrency, number> = {
  usd: 1,    eur: 0.88, ars: 1550, bob: 12.5, brl: 6.0,  cad: 1.4,
  clp: 990,  cop: 4200, crc: 520,  dop: 60,   gtq: 7.8,  gyd: 210,
  htg: 130,  hnl: 25,   jmd: 158,  mxn: 20.5, nio: 37,   pen: 3.75,
  pyg: 7800, uyu: 43,   bsd: 1,    bbd: 2,    bzd: 2,    srd: 38,
  ttd: 6.8,
};

/** Currencies without fractional units — rounded to whole tens by Stripe. */
export const ZERO_DECIMAL_CURRENCIES = new Set<PaymentCurrency>(['clp', 'pyg']);

export const CURRENCY_SYMBOLS: Record<PaymentCurrency, string> = {
  usd: '$',    eur: '€',    ars: '$',    bob: 'Bs',   brl: 'R$',
  cad: 'CA$',  clp: '$',    cop: '$',    crc: '₡',   dop: 'RD$',
  gtq: 'Q',    gyd: 'G$',   hnl: 'L',    htg: 'G',   jmd: 'J$',
  mxn: '$',    nio: 'C$',   pen: 'S/',   pyg: '₲',  uyu: '$U',
  bsd: 'B$',   bbd: 'Bds$', bzd: 'BZ$',  srd: 'Sr$', ttd: 'TT$',
};

// Venezuela pays in USD even though the tenant currency is VES — see user
// requirement: local bolívar is not widely accepted, so plans always bill
// in dollars for VE tenants.
const VE_COUNTRY_CODE = 'VE';

/**
 * Map a tenant's country → the currency we will *charge* them in.
 * - VE is hard-coded to USD.
 * - Unsupported currency codes fall back to USD.
 */
export function resolveCheckoutCurrency(
  countryCode: string | null | undefined,
  countryDefaultCurrency: string | null | undefined
): PaymentCurrency {
  if (countryCode === VE_COUNTRY_CODE) return 'usd';
  const lower = (countryDefaultCurrency ?? 'usd').toLowerCase();
  return (lower in CHECKOUT_FX_RATES ? lower : 'usd') as PaymentCurrency;
}

/** Convert a USD amount to the local currency using the mirrored FX table. */
export function convertUsdToLocal(
  usd: number,
  currency: PaymentCurrency
): number {
  const rate = CHECKOUT_FX_RATES[currency] ?? 1;
  const local = usd * rate;
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return Math.round(local / 10) * 10;
  return Math.round(local * 100) / 100;
}

export interface CheckoutRequest {
  planId: string;
  billingPeriod: BillingPeriod;
  tenantId: number;
  successUrl: string;
  cancelUrl: string;
  catalogAddonQuantity?: number;
  /** ISO-4217 (lowercase) — defaults to USD if omitted by the edge function. */
  currency?: PaymentCurrency;
  /** Promotion code text (e.g. "AVANZADO24") pre-validated in our UI. The
   *  edge function resolves it to a `promo_xxx` ID and passes it to Stripe
   *  as `discounts: [{ promotion_code }]`. */
  promotionCode?: string;
}

export interface CheckoutSession {
  url: string;
  currency?: PaymentCurrency;
}

export interface CancelSubscriptionResult {
  /** 'stripe' = cancelación en Stripe · 'manual' = plan manual/Venezuela. */
  mode: 'stripe' | 'manual';
  /** true si se canceló al instante (past_due/unpaid o plan manual);
   *  false si quedó programada para el fin del período ya pagado. */
  immediate: boolean;
  /** Fecha (ISO) hasta la que el plan sigue activo, cuando aplica. */
  activeUntil: string | null;
}

export interface PromotionCodeValidation {
  promotionCodeId: string;
  code: string;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
}

export interface CatalogCheckoutRequest {
  tenantId: number;
  successUrl: string;
  cancelUrl: string;
}

/** Upgrade de plan con prorrateo (edge fn `change-plan`). Solo aplica cuando el
 *  tenant ya tiene una suscripción de Stripe activa y sube a un plan más caro:
 *  se cobra SOLO la diferencia prorrateada con la tarjeta guardada, sin pasar
 *  por el checkout. Los demás casos siguen por `create-checkout-session`. */
export interface ChangePlanRequest {
  tenantId: number;
  planId: string;
  billingPeriod: BillingPeriod;
}

export interface ChangePlanResult {
  success: boolean;
  subscriptionId?: string;
}

export interface UpdateCatalogSlotsRequest {
  tenantId: number;
  additionalQuantity: number;
}
