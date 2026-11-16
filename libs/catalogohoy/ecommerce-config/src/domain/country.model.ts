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
  { name: 'Dominican Republic', label: 'República Dominicana', code: 'DO', dialCode: '+1',    defaultCurrency: 'DOP', decimalSeparator: '.', thousandSeparator: ',' },
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

// ── Zona horaria del negocio ────────────────────────────────────────────────
// Se usa para calcular el estado "abierto/cerrado" del catálogo contra la hora
// del NEGOCIO (no la del dispositivo del visitante). Espejo del map SQL
// `default_timezone_for_country` (migración 20261010_business_timezone). El día
// de la semana lo calcula el RPC get_public_catalog en esta misma zona.
export const DEFAULT_TIMEZONE_BY_COUNTRY: Record<string, string> = {
  VE: 'America/Caracas',
  CO: 'America/Bogota',
  MX: 'America/Mexico_City',
  AR: 'America/Argentina/Buenos_Aires',
  PE: 'America/Lima',
  EC: 'America/Guayaquil',
  BO: 'America/La_Paz',
  GT: 'America/Guatemala',
  DO: 'America/Santo_Domingo',
  CL: 'America/Santiago',
  HN: 'America/Tegucigalpa',
  PY: 'America/Asuncion',
  CR: 'America/Costa_Rica',
  US: 'America/New_York',
  NI: 'America/Managua',
  PA: 'America/Panama',
  SV: 'America/El_Salvador',
  UY: 'America/Montevideo',
  BR: 'America/Sao_Paulo',
  ES: 'Europe/Madrid',
  HT: 'America/Port-au-Prince',
  JM: 'America/Jamaica',
  PR: 'America/Puerto_Rico',
  BB: 'America/Barbados',
  BS: 'America/Nassau',
  GY: 'America/Guyana',
  SR: 'America/Paramaribo',
  CA: 'America/Toronto',
  CU: 'America/Havana',
  BZ: 'America/Belize',
};

export function defaultTimezoneForCountry(
  code: string | null | undefined
): string {
  return DEFAULT_TIMEZONE_BY_COUNTRY[(code ?? '').toUpperCase()] ?? 'America/Caracas';
}

export interface TimezoneOption {
  /** IANA id persistido, ej. "America/Mexico_City". */
  value: string;
  /** Etiqueta legible para el selector. */
  label: string;
  /** País (ISO-2) al que pertenece esta zona — filtra el selector por país. */
  country: string;
}

// Lista curada de zonas IANA relevantes para los países soportados. Los países
// multi-zona (México, EE. UU., Brasil, Chile, Ecuador, España) incluyen sus
// zonas alternas para que el dueño pueda elegir la correcta. El selector del
// editor filtra por el país del negocio (ver timezonesForCountry).
export const SUPPORTED_TIMEZONES: TimezoneOption[] = [
  { value: 'America/Caracas', label: 'Caracas', country: 'VE' },
  { value: 'America/Bogota', label: 'Bogotá', country: 'CO' },
  { value: 'America/Mexico_City', label: 'Centro (Ciudad de México)', country: 'MX' },
  { value: 'America/Cancun', label: 'Sureste (Cancún / Quintana Roo)', country: 'MX' },
  { value: 'America/Mazatlan', label: 'Pacífico (Mazatlán / Sinaloa, Nayarit)', country: 'MX' },
  { value: 'America/Hermosillo', label: 'Noroeste (Hermosillo / Sonora)', country: 'MX' },
  { value: 'America/Tijuana', label: 'Noroeste (Tijuana / Baja California)', country: 'MX' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires', country: 'AR' },
  { value: 'America/Lima', label: 'Lima', country: 'PE' },
  { value: 'America/Guayaquil', label: 'Continental (Guayaquil / Quito)', country: 'EC' },
  { value: 'Pacific/Galapagos', label: 'Galápagos', country: 'EC' },
  { value: 'America/La_Paz', label: 'La Paz', country: 'BO' },
  { value: 'America/Guatemala', label: 'Guatemala', country: 'GT' },
  { value: 'America/Santo_Domingo', label: 'Santo Domingo', country: 'DO' },
  { value: 'America/Santiago', label: 'Continental (Santiago)', country: 'CL' },
  { value: 'Pacific/Easter', label: 'Isla de Pascua', country: 'CL' },
  { value: 'America/Tegucigalpa', label: 'Tegucigalpa', country: 'HN' },
  { value: 'America/Asuncion', label: 'Asunción', country: 'PY' },
  { value: 'America/Costa_Rica', label: 'San José', country: 'CR' },
  { value: 'America/Managua', label: 'Managua', country: 'NI' },
  { value: 'America/Panama', label: 'Panamá', country: 'PA' },
  { value: 'America/El_Salvador', label: 'San Salvador', country: 'SV' },
  { value: 'America/Montevideo', label: 'Montevideo', country: 'UY' },
  { value: 'America/Sao_Paulo', label: 'Este (Brasília / São Paulo)', country: 'BR' },
  { value: 'America/Manaus', label: 'Amazonas (Manaus)', country: 'BR' },
  { value: 'America/New_York', label: 'Este (New York)', country: 'US' },
  { value: 'America/Chicago', label: 'Central (Chicago)', country: 'US' },
  { value: 'America/Denver', label: 'Montaña (Denver)', country: 'US' },
  { value: 'America/Los_Angeles', label: 'Pacífico (Los Angeles)', country: 'US' },
  { value: 'America/Puerto_Rico', label: 'San Juan', country: 'PR' },
  { value: 'Europe/Madrid', label: 'Peninsular (Madrid)', country: 'ES' },
  { value: 'Atlantic/Canary', label: 'Canarias', country: 'ES' },
  { value: 'America/Port-au-Prince', label: 'Puerto Príncipe', country: 'HT' },
  { value: 'America/Jamaica', label: 'Kingston', country: 'JM' },
  { value: 'America/Toronto', label: 'Este (Toronto)', country: 'CA' },
  { value: 'America/Havana', label: 'La Habana', country: 'CU' },
];

/** Zonas horarias a mostrar en el selector para un país. Devuelve las zonas de
 *  ese país (varias si es multi-zona). Si el país no tiene zonas curadas, cae a
 *  una única opción con su zona por defecto — así todo país muestra al menos su
 *  zona correcta. */
export function timezonesForCountry(
  code: string | null | undefined
): TimezoneOption[] {
  const cc = (code ?? '').toUpperCase();
  const list = SUPPORTED_TIMEZONES.filter((t) => t.country === cc);
  if (list.length) return list;
  const fallback = defaultTimezoneForCountry(cc);
  return [{ value: fallback, label: fallback.split('/').pop()?.replace(/_/g, ' ') ?? fallback, country: cc }];
}
