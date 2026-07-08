import {
  CATALOG_ADDON_PRICE,
  CHECKOUT_FX_RATES,
  convertUsdToLocal,
  CURRENCY_SYMBOLS,
  PaymentCurrency,
  PLAN_BASE_PRICES,
  resolveCheckoutCurrency,
  ZERO_DECIMAL_CURRENCIES,
} from './checkout.model';

describe('checkout.model — multi-currency helpers', () => {
  describe('resolveCheckoutCurrency', () => {
    it('forces USD for Venezuela even when the country default is VES', () => {
      expect(resolveCheckoutCurrency('VE', 'VES')).toBe('usd');
    });

    it('uses the country default when Stripe supports it', () => {
      expect(resolveCheckoutCurrency('BR', 'BRL')).toBe('brl');
      expect(resolveCheckoutCurrency('MX', 'MXN')).toBe('mxn');
      expect(resolveCheckoutCurrency('ES', 'EUR')).toBe('eur');
    });

    it('falls back to USD for unsupported currencies (e.g. CUP)', () => {
      expect(resolveCheckoutCurrency('CU', 'CUP')).toBe('usd');
    });

    it('falls back to USD when country/currency are null or missing', () => {
      expect(resolveCheckoutCurrency(null, null)).toBe('usd');
      expect(resolveCheckoutCurrency(undefined, undefined)).toBe('usd');
      expect(resolveCheckoutCurrency('US', undefined)).toBe('usd');
    });

    it('normalizes case — uppercase VES still resolves to lower usd (VE path)', () => {
      expect(resolveCheckoutCurrency('VE', 'ves')).toBe('usd');
    });

    it('non-VE uppercase currency still resolves via lowercase lookup', () => {
      expect(resolveCheckoutCurrency('AR', 'ARS')).toBe('ars');
    });
  });

  describe('convertUsdToLocal', () => {
    it('passes USD through as-is', () => {
      expect(convertUsdToLocal(9.99, 'usd')).toBe(9.99);
    });

    it('applies the FX rate for 2-decimal currencies', () => {
      // 9.99 * 6.0 = 59.94 (BRL)
      expect(convertUsdToLocal(9.99, 'brl')).toBe(59.94);
      // 9.99 * 20.5 = 204.795 → rounded to 204.80
      expect(convertUsdToLocal(9.99, 'mxn')).toBe(204.8);
    });

    it('rounds zero-decimal currencies to the nearest 10', () => {
      // CLP: 9.99 * 990 = 9890.1 → /10 round → 989 * 10 = 9890
      expect(convertUsdToLocal(9.99, 'clp')).toBe(9890);
      // PYG: 9.99 * 7800 = 77922 → /10 round → 77920
      expect(convertUsdToLocal(9.99, 'pyg')).toBe(77920);
    });

    it('rounds halves consistently (Math.round semantics)', () => {
      // 0.5 usd * 100 cents → use a deterministic currency with rate 1
      expect(convertUsdToLocal(0.005, 'usd')).toBe(0.01);
    });

    it('handles zero input', () => {
      expect(convertUsdToLocal(0, 'brl')).toBe(0);
      expect(convertUsdToLocal(0, 'clp')).toBe(0);
    });

    it('stays consistent across all listed supported currencies', () => {
      for (const currency of Object.keys(CHECKOUT_FX_RATES) as PaymentCurrency[]) {
        const result = convertUsdToLocal(10, currency);
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('invariants on the currency tables', () => {
    it('every FX-rate currency has a symbol', () => {
      for (const code of Object.keys(CHECKOUT_FX_RATES)) {
        expect(CURRENCY_SYMBOLS[code as PaymentCurrency]).toBeDefined();
      }
    });

    it('zero-decimal set is a subset of the FX table', () => {
      for (const code of ZERO_DECIMAL_CURRENCIES) {
        expect(CHECKOUT_FX_RATES[code]).toBeDefined();
      }
    });

    it('plan base prices have the expected shape', () => {
      expect(PLAN_BASE_PRICES['basico']).toBe(9.99);
      expect(PLAN_BASE_PRICES['avanzado']).toBe(19.99);
      expect(CATALOG_ADDON_PRICE).toBe(4.99);
    });
  });
});
