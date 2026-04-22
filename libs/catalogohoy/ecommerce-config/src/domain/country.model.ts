export interface CountryOption {
  /** English name — must match what countriesnow.space expects for states/cities lookup */
  name: string;
  /** Spanish label — shown in UI and persisted as tenants.country */
  label: string;
  code: string;
  /** E.164 dial code (with leading +). Used by the public checkout phone input. */
  dialCode: string;
  defaultCurrency: string;
  decimalSeparator: string;
  thousandSeparator: string;
}

// All Americas + Spain. Order: Venezuela first (largest current user base),
// then alphabetical by Spanish label.
export const SUPPORTED_COUNTRIES: CountryOption[] = [
  { name: 'Venezuela',          label: 'Venezuela',           code: 'VE', dialCode: '+58',   defaultCurrency: 'VES', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Argentina',          label: 'Argentina',           code: 'AR', dialCode: '+54',   defaultCurrency: 'ARS', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Bahamas',            label: 'Bahamas',             code: 'BS', dialCode: '+1242', defaultCurrency: 'BSD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Barbados',           label: 'Barbados',            code: 'BB', dialCode: '+1246', defaultCurrency: 'BBD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Belize',             label: 'Belice',              code: 'BZ', dialCode: '+501',  defaultCurrency: 'BZD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Bolivia',            label: 'Bolivia',             code: 'BO', dialCode: '+591',  defaultCurrency: 'BOB', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Brazil',             label: 'Brasil',              code: 'BR', dialCode: '+55',   defaultCurrency: 'BRL', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Canada',             label: 'Canadá',              code: 'CA', dialCode: '+1',    defaultCurrency: 'CAD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Chile',              label: 'Chile',               code: 'CL', dialCode: '+56',   defaultCurrency: 'CLP', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Colombia',           label: 'Colombia',            code: 'CO', dialCode: '+57',   defaultCurrency: 'COP', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Costa Rica',         label: 'Costa Rica',          code: 'CR', dialCode: '+506',  defaultCurrency: 'CRC', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Cuba',               label: 'Cuba',                code: 'CU', dialCode: '+53',   defaultCurrency: 'CUP', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Ecuador',            label: 'Ecuador',             code: 'EC', dialCode: '+593',  defaultCurrency: 'USD', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'El Salvador',        label: 'El Salvador',         code: 'SV', dialCode: '+503',  defaultCurrency: 'USD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Spain',              label: 'España',              code: 'ES', dialCode: '+34',   defaultCurrency: 'EUR', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'United States',      label: 'Estados Unidos',      code: 'US', dialCode: '+1',    defaultCurrency: 'USD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Guatemala',          label: 'Guatemala',           code: 'GT', dialCode: '+502',  defaultCurrency: 'GTQ', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Guyana',             label: 'Guyana',              code: 'GY', dialCode: '+592',  defaultCurrency: 'GYD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Haiti',              label: 'Haití',               code: 'HT', dialCode: '+509',  defaultCurrency: 'HTG', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Honduras',           label: 'Honduras',            code: 'HN', dialCode: '+504',  defaultCurrency: 'HNL', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Jamaica',            label: 'Jamaica',             code: 'JM', dialCode: '+1876', defaultCurrency: 'JMD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Mexico',             label: 'México',              code: 'MX', dialCode: '+52',   defaultCurrency: 'MXN', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Nicaragua',          label: 'Nicaragua',           code: 'NI', dialCode: '+505',  defaultCurrency: 'NIO', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Panama',             label: 'Panamá',              code: 'PA', dialCode: '+507',  defaultCurrency: 'USD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Paraguay',           label: 'Paraguay',            code: 'PY', dialCode: '+595',  defaultCurrency: 'PYG', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Peru',               label: 'Perú',                code: 'PE', dialCode: '+51',   defaultCurrency: 'PEN', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Puerto Rico',        label: 'Puerto Rico',         code: 'PR', dialCode: '+1787', defaultCurrency: 'USD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Dominican Republic', label: 'República Dominicana', code: 'DO', dialCode: '+1809', defaultCurrency: 'DOP', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Suriname',           label: 'Surinam',             code: 'SR', dialCode: '+597',  defaultCurrency: 'SRD', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Trinidad and Tobago', label: 'Trinidad y Tobago',  code: 'TT', dialCode: '+1868', defaultCurrency: 'TTD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Uruguay',            label: 'Uruguay',             code: 'UY', dialCode: '+598',  defaultCurrency: 'UYU', decimalSeparator: '.', thousandSeparator: ',' },
];

/** Flag emoji from ISO-3166-1 alpha-2 code. 'VE' → '🇻🇪'. */
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$',    name: 'Dólar estadounidense' },
  { code: 'EUR', symbol: '€',    name: 'Euro' },
  { code: 'VES', symbol: 'Bs.',  name: 'Bolívar venezolano' },
  { code: 'ARS', symbol: '$',    name: 'Peso argentino' },
  { code: 'BBD', symbol: 'Bds$', name: 'Dólar de Barbados' },
  { code: 'BOB', symbol: 'Bs',   name: 'Boliviano' },
  { code: 'BRL', symbol: 'R$',   name: 'Real brasileño' },
  { code: 'BSD', symbol: 'B$',   name: 'Dólar bahameño' },
  { code: 'BZD', symbol: 'BZ$',  name: 'Dólar de Belice' },
  { code: 'CAD', symbol: 'CA$',  name: 'Dólar canadiense' },
  { code: 'CLP', symbol: '$',    name: 'Peso chileno' },
  { code: 'COP', symbol: '$',    name: 'Peso colombiano' },
  { code: 'CRC', symbol: '₡',    name: 'Colón costarricense' },
  { code: 'CUP', symbol: '$',    name: 'Peso cubano' },
  { code: 'DOP', symbol: 'RD$',  name: 'Peso dominicano' },
  { code: 'GTQ', symbol: 'Q',    name: 'Quetzal guatemalteco' },
  { code: 'GYD', symbol: 'G$',   name: 'Dólar guyanés' },
  { code: 'HNL', symbol: 'L',    name: 'Lempira hondureña' },
  { code: 'HTG', symbol: 'G',    name: 'Gourde haitiana' },
  { code: 'JMD', symbol: 'J$',   name: 'Dólar jamaicano' },
  { code: 'MXN', symbol: '$',    name: 'Peso mexicano' },
  { code: 'NIO', symbol: 'C$',   name: 'Córdoba nicaragüense' },
  { code: 'PEN', symbol: 'S/',   name: 'Sol peruano' },
  { code: 'PYG', symbol: '₲',    name: 'Guaraní paraguayo' },
  { code: 'SRD', symbol: 'Sr$',  name: 'Dólar surinamés' },
  { code: 'TTD', symbol: 'TT$',  name: 'Dólar trinitense' },
  { code: 'UYU', symbol: '$U',   name: 'Peso uruguayo' },
];

export function findCountryByCode(code: string | null | undefined): CountryOption | null {
  if (!code) return null;
  return SUPPORTED_COUNTRIES.find((c) => c.code === code) ?? null;
}

export function findCurrencyByCode(code: string | null | undefined): CurrencyOption | null {
  if (!code) return null;
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) ?? null;
}

// Fallback label (Spanish) when `tenants.country` is null but `country_code` is set.
// Used to avoid a data backfill in the migration.
export function countryNameFromCode(code: string | null | undefined): string | null {
  const found = findCountryByCode(code);
  return found?.label ?? null;
}
