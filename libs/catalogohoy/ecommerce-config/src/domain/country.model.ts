export interface CountryOption {
  /** English name — must match what countriesnow.space expects for states/cities lookup */
  name: string;
  /** Spanish label — shown in UI and persisted as tenants.country */
  label: string;
  code: string;
  defaultCurrency: string;
  decimalSeparator: string;
  thousandSeparator: string;
}

// All Americas + Spain. Order: Venezuela first (largest current user base),
// then alphabetical by Spanish label.
export const SUPPORTED_COUNTRIES: CountryOption[] = [
  { name: 'Venezuela',          label: 'Venezuela',           code: 'VE', defaultCurrency: 'VES', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Argentina',          label: 'Argentina',           code: 'AR', defaultCurrency: 'ARS', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Bahamas',            label: 'Bahamas',             code: 'BS', defaultCurrency: 'BSD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Barbados',           label: 'Barbados',            code: 'BB', defaultCurrency: 'BBD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Belize',             label: 'Belice',              code: 'BZ', defaultCurrency: 'BZD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Bolivia',            label: 'Bolivia',             code: 'BO', defaultCurrency: 'BOB', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Brazil',             label: 'Brasil',              code: 'BR', defaultCurrency: 'BRL', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Canada',             label: 'Canadá',              code: 'CA', defaultCurrency: 'CAD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Chile',              label: 'Chile',               code: 'CL', defaultCurrency: 'CLP', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Colombia',           label: 'Colombia',            code: 'CO', defaultCurrency: 'COP', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Costa Rica',         label: 'Costa Rica',          code: 'CR', defaultCurrency: 'CRC', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Cuba',               label: 'Cuba',                code: 'CU', defaultCurrency: 'CUP', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Ecuador',            label: 'Ecuador',             code: 'EC', defaultCurrency: 'USD', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'El Salvador',        label: 'El Salvador',         code: 'SV', defaultCurrency: 'USD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Spain',              label: 'España',              code: 'ES', defaultCurrency: 'EUR', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'United States',      label: 'Estados Unidos',      code: 'US', defaultCurrency: 'USD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Guatemala',          label: 'Guatemala',           code: 'GT', defaultCurrency: 'GTQ', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Guyana',             label: 'Guyana',              code: 'GY', defaultCurrency: 'GYD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Haiti',              label: 'Haití',               code: 'HT', defaultCurrency: 'HTG', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Honduras',           label: 'Honduras',            code: 'HN', defaultCurrency: 'HNL', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Jamaica',            label: 'Jamaica',             code: 'JM', defaultCurrency: 'JMD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Mexico',             label: 'México',              code: 'MX', defaultCurrency: 'MXN', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Nicaragua',          label: 'Nicaragua',           code: 'NI', defaultCurrency: 'NIO', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Panama',             label: 'Panamá',              code: 'PA', defaultCurrency: 'USD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Paraguay',           label: 'Paraguay',            code: 'PY', defaultCurrency: 'PYG', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Peru',               label: 'Perú',                code: 'PE', defaultCurrency: 'PEN', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Puerto Rico',        label: 'Puerto Rico',         code: 'PR', defaultCurrency: 'USD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Dominican Republic', label: 'República Dominicana', code: 'DO', defaultCurrency: 'DOP', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Suriname',           label: 'Surinam',             code: 'SR', defaultCurrency: 'SRD', decimalSeparator: ',', thousandSeparator: '.' },
  { name: 'Trinidad and Tobago', label: 'Trinidad y Tobago',  code: 'TT', defaultCurrency: 'TTD', decimalSeparator: '.', thousandSeparator: ',' },
  { name: 'Uruguay',            label: 'Uruguay',             code: 'UY', defaultCurrency: 'UYU', decimalSeparator: ',', thousandSeparator: '.' },
];

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
