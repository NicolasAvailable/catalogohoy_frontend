// Símbolo de la moneda de REFERENCIA de un catálogo (la moneda en la que está
// `orders.total_usd`). Espejo de TenantCurrencyStore.displaySymbol del front.
//
// ⚠️ `tenant_currency_config.currency_symbol` es el símbolo de la moneda LOCAL
// (de los productos). En Venezuela casi siempre es 'Bs.', aunque los totales
// estén en $ o €. Usarlo para `total_usd` producía "Bs.183,24 (Bs. 196.066,80)"
// en los avisos de pedido, facturas y recordatorios (bug 2026-11-14, Motofox).
//
// Regla:
//   - centinela "sin símbolo" (U+200B) → '' (el catálogo oculta el símbolo).
//   - catálogo dual (VE) o con moneda de referencia distinta a la de los
//     productos → símbolo de display_currency ($, €, Bs.).
//   - resto → currency_symbol tal cual (RD$, Q, S/, R$…).
export const NO_CURRENCY_SYMBOL = "​";

const DISPLAY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  VES: "Bs. ",
};

export type ReferenceCurrencyCfg = {
  currency_symbol?: string | null;
  product_currency?: string | null;
  display_currency?: string | null;
  show_dual_currency?: boolean | null;
};

export function referenceSymbol(cfg: ReferenceCurrencyCfg | null | undefined): string {
  const raw = cfg?.currency_symbol ?? null;
  if (raw === NO_CURRENCY_SYMBOL) return "";
  const local = (raw ?? "$").trim() || "$";
  const display = cfg?.display_currency ?? null;
  const product = cfg?.product_currency ?? null;
  const usesReference = cfg?.show_dual_currency === true || (!!display && display !== product);
  if (usesReference && display && DISPLAY_SYMBOLS[display]) return DISPLAY_SYMBOLS[display];
  return local;
}
