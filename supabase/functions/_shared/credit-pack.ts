// Créditos de IA comprados junto con el plan (checkout de planes y upgrade con
// prorrateo). Precio y descuento por volumen = MISMA tabla que
// `create-credit-checkout` (autoritativa para la compra suelta) y que
// `CREDITS_*` / `creditQuote` del front (solo display). Si cambia uno, cambian
// todos.
//
// La compra suelta cobra siempre en USD; acá el pack va en la MISMA factura que
// el plan, así que se cobra en la moneda del checkout / de la suscripción,
// convertido con la misma tabla FX que los currency_options de los planes
// (CHECKOUT_FX_RATES del front).

export const CREDITS_BASE_CENTS = 1.9; // $0.019 / crédito
export const CREDITS_MIN = 100;
export const CREDITS_MAX = 5000;
export const CREDITS_STEP = 50;

export function creditsVolumeDiscount(credits: number): number {
  if (credits >= 2000) return 0.10;
  if (credits >= 1000) return 0.08;
  if (credits >= 600) return 0.06;
  if (credits >= 300) return 0.05;
  return 0;
}

/** 0 = sin créditos. Si no, entero múltiplo de STEP dentro de [MIN, MAX]. */
export function normalizeCredits(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  let c = Math.round(n / CREDITS_STEP) * CREDITS_STEP;
  if (c < CREDITS_MIN) c = CREDITS_MIN;
  if (c > CREDITS_MAX) c = CREDITS_MAX;
  return c;
}

export function creditsPriceUsdCents(credits: number): number {
  return Math.round(credits * CREDITS_BASE_CENTS * (1 - creditsVolumeDiscount(credits)));
}

const FX_RATES: Record<string, number> = {
  usd: 1,    eur: 0.88, ars: 1550, bob: 12.5, brl: 6.0,  cad: 1.4,
  clp: 990,  cop: 4200, crc: 520,  dop: 60,   gtq: 7.8,  gyd: 210,
  htg: 130,  hnl: 25,   jmd: 158,  mxn: 20.5, nio: 37,   pen: 3.75,
  pyg: 7800, uyu: 43,   bsd: 1,    bbd: 2,    bzd: 2,    srd: 38,
  ttd: 6.8,
};
const ZERO_DECIMAL = new Set(["clp", "pyg"]);

/** Monto del pack en unidades menores de `currency` (lo que espera Stripe).
 *  Mismo redondeo que `convertUsdToLocal` del front. */
export function creditsAmountMinor(credits: number, currency: string): number {
  const cur = currency.toLowerCase();
  const rate = FX_RATES[cur] ?? 1;
  const usd = creditsPriceUsdCents(credits) / 100;
  const local = usd * rate;
  if (ZERO_DECIMAL.has(cur)) return Math.round(local / 10) * 10;
  return Math.round(Math.round(local * 100) / 100 * 100);
}

export function creditsLabel(credits: number): string {
  return `${credits} créditos de IA`;
}

/** Monedas en las que se puede cobrar el pack (las de la tabla FX). */
export function creditsCurrencySupported(currency: string): boolean {
  return currency.toLowerCase() in FX_RATES;
}
