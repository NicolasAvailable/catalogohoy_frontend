export interface WhatsappButton {
  name: string;
  number: string;
}

export type PaymentMethod =
  | 'efectivo'
  | 'transferencia'
  | 'tarjeta_credito'
  | 'pago_movil'
  | 'binance'
  | 'zelle'
  | 'paypal';

export const THEME_COLORS: { name: string; value: string }[] = [
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violeta', value: '#8b5cf6' },
  { name: 'Verde', value: '#10b981' },
  { name: 'Menta', value: '#14b8a6' },
  { name: 'Naranja', value: '#f97316' },
  { name: 'Amarillo', value: '#eab308' },
  { name: 'Salmon', value: '#fb7185' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Magenta', value: '#d946ef' },
  { name: 'Lila', value: '#a78bfa' },
  { name: 'Lavanda', value: '#c4b5fd' },
  { name: 'Negro', value: '#171717' },
  { name: 'Gris', value: '#6b7280' },
];

export const PAYMENT_METHOD_OPTIONS: { label: string; value: PaymentMethod }[] =
  [
    { label: 'Efectivo', value: 'efectivo' },
    { label: 'Transferencia', value: 'transferencia' },
    { label: 'Tarjeta de crédito', value: 'tarjeta_credito' },
    { label: 'Pago móvil', value: 'pago_movil' },
    { label: 'Binance', value: 'binance' },
    { label: 'Zelle', value: 'zelle' },
    { label: 'PayPal', value: 'paypal' },
  ];

export const DEFAULT_PAYMENT_METHODS: { name: string; icon: string }[] = [
  { name: 'Efectivo', icon: 'banknote' },
  { name: 'Pago movil', icon: 'smartphone' },
  { name: 'PayPal', icon: 'globe' },
  { name: 'Transferencia', icon: 'building' },
  { name: 'Zelle', icon: 'dollar-sign' },
  { name: 'Binance', icon: 'coins' },
  { name: 'Tarjeta de credito', icon: 'credit-card' },
];

export const VENEZUELAN_STATES: string[] = [
  'Amazonas',
  'Anzoátegui',
  'Apure',
  'Aragua',
  'Barinas',
  'Bolívar',
  'Carabobo',
  'Cojedes',
  'Delta Amacuro',
  'Distrito Capital',
  'Falcón',
  'Guárico',
  'Lara',
  'Mérida',
  'Miranda',
  'Monagas',
  'Nueva Esparta',
  'Portuguesa',
  'Sucre',
  'Táchira',
  'Trujillo',
  'Vargas',
  'Yaracuy',
  'Zulia',
];

export interface PaymentMethodEntity {
  id: number;
  tenantId: number;
  name: string;
  icon: string;
  isActive: boolean;
  createdAt: string;
  /** Datos del método (banco, cuenta, titular…) keyed por campo. Se muestran
   *  en el checkout cuando el cliente elige ese método. */
  details: Record<string, string>;
}

/** Un campo configurable de un método de pago. */
export interface PaymentFieldDef {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}

/**
 * Campos por "tipo" de método de pago. Los métodos se crean con nombre libre,
 * así que el tipo se infiere del nombre (ver detectPaymentMethodType). Los
 * métodos que no matchean ningún tipo conocido usan 'otro' (texto libre).
 */
export const PAYMENT_METHOD_FIELDS: Record<string, PaymentFieldDef[]> = {
  transferencia: [
    { key: 'banco', label: 'Banco', placeholder: 'Ej: Mercantil' },
    { key: 'numeroCuenta', label: 'Número de cuenta', placeholder: 'Ej: 0105-1234-56-7890123456' },
    { key: 'tipoCuenta', label: 'Tipo de cuenta', placeholder: 'Corriente / Ahorro' },
    { key: 'titular', label: 'Titular', placeholder: 'Nombre del titular' },
    { key: 'documento', label: 'Cédula / RIF', placeholder: 'Ej: V-12.345.678' },
  ],
  // Transferencia fuera de Venezuela: solo titular, cuenta e instrucciones.
  transferencia_intl: [
    { key: 'titular', label: 'Titular', placeholder: 'Nombre del titular' },
    { key: 'numeroCuenta', label: 'Número de cuenta', placeholder: 'Ej: IBAN / número de cuenta' },
    { key: 'instrucciones', label: 'Instrucciones', placeholder: 'Datos adicionales para la transferencia', multiline: true },
  ],
  pago_movil: [
    { key: 'telefono', label: 'Teléfono', placeholder: 'Ej: 0414-1234567' },
    { key: 'banco', label: 'Banco', placeholder: 'Ej: Banesco' },
    { key: 'documento', label: 'Cédula', placeholder: 'Ej: V-12.345.678' },
  ],
  zelle: [
    { key: 'email', label: 'Correo (email)', placeholder: 'Ej: pagos@tienda.com' },
    { key: 'titular', label: 'Titular', placeholder: 'Nombre del titular' },
  ],
  binance: [
    { key: 'email', label: 'Correo / Pay ID', placeholder: 'Email o ID de Binance Pay' },
    { key: 'titular', label: 'Titular', placeholder: 'Nombre (opcional)' },
  ],
  paypal: [
    { key: 'email', label: 'Correo / Enlace', placeholder: 'Email o paypal.me/tutienda' },
    { key: 'titular', label: 'Titular', placeholder: 'Nombre (opcional)' },
  ],
  efectivo: [
    { key: 'instrucciones', label: 'Instrucciones', placeholder: 'Ej: Pagás al recibir el pedido', multiline: true },
  ],
  tarjeta_credito: [
    { key: 'instrucciones', label: 'Instrucciones', placeholder: 'Cómo pagar con tarjeta', multiline: true },
  ],
  otro: [
    { key: 'instrucciones', label: 'Datos / instrucciones', placeholder: 'Datos que el cliente necesita para pagar', multiline: true },
  ],
};

/** Infiere el "tipo" de un método a partir de su nombre (nombres libres). */
export function detectPaymentMethodType(name: string): string {
  const n = (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (n.includes('transferencia')) return 'transferencia';
  if (n.includes('pago movil') || n.includes('pagomovil')) return 'pago_movil';
  if (n.includes('zelle')) return 'zelle';
  if (n.includes('binance')) return 'binance';
  if (n.includes('paypal')) return 'paypal';
  if (n.includes('efectivo')) return 'efectivo';
  if (n.includes('tarjeta')) return 'tarjeta_credito';
  return 'otro';
}

/**
 * Campos configurables de un método según su nombre. Para transferencia, fuera
 * de Venezuela se usa un set reducido (titular, cuenta, instrucciones).
 */
export function paymentMethodFields(
  name: string,
  isVenezuela = true
): PaymentFieldDef[] {
  const type = detectPaymentMethodType(name);
  if (type === 'transferencia' && !isVenezuela) {
    return PAYMENT_METHOD_FIELDS['transferencia_intl'];
  }
  return PAYMENT_METHOD_FIELDS[type] ?? PAYMENT_METHOD_FIELDS['otro'];
}

export interface SocialLink {
  url: string;
  visible: boolean;
}

export interface SocialLinks {
  instagram: SocialLink;
  facebook: SocialLink;
  tiktok: SocialLink;
}

export const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  instagram: { url: '', visible: false },
  facebook: { url: '', visible: false },
  tiktok: { url: '', visible: false },
};

/** A shipping/delivery option the merchant offers at checkout. Stored as a
 *  JSON array on `tenant_ecommerce_config.shipping_methods`. `id` is a
 *  client-generated uuid (jsonb rows have no DB id). */
export type ShippingMethodType = 'pickup' | 'delivery' | 'shipping';

export interface ShippingMethod {
  id: string;
  name: string;
  type: ShippingMethodType;
  /** Flat fee added to the order total. 0 = free. */
  fee: number;
  instructions: string;
  /** delivery/shipping: ask the customer to type their address at checkout. */
  requestCustomerAddress: boolean;
  /** pickup-only: store address + coordinates for the embedded map. */
  address: string | null;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  isDefault: boolean;
  position: number;
}

export const SHIPPING_METHOD_TYPE_OPTIONS: {
  label: string;
  value: ShippingMethodType;
}[] = [
  { label: 'Retiro en local', value: 'pickup' },
  { label: 'Entrega personal', value: 'delivery' },
  { label: 'Envío', value: 'shipping' },
];

export function createDefaultShippingMethod(position: number): ShippingMethod {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `sm_${position}_${Date.now()}`,
    name: '',
    type: 'pickup',
    fee: 0,
    instructions: '',
    requestCustomerAddress: false,
    address: null,
    lat: null,
    lng: null,
    isActive: true,
    isDefault: position === 0,
    position,
  };
}

/** Seeded so a fresh catalog never shows an empty shipping list: a local
 *  pickup and a national shipping option. Stable ids keep draft/config JSON
 *  comparisons consistent across renders (no random UUIDs). */
export function createDefaultShippingMethods(): ShippingMethod[] {
  return [
    {
      id: 'seed-pickup',
      name: 'Recoger en el local',
      type: 'pickup',
      fee: 0,
      instructions: '',
      requestCustomerAddress: false,
      address: null,
      lat: null,
      lng: null,
      isActive: true,
      isDefault: true,
      position: 0,
    },
    {
      id: 'seed-shipping',
      name: 'Envío nacional',
      type: 'shipping',
      fee: 0,
      instructions: '',
      requestCustomerAddress: true,
      address: null,
      lat: null,
      lng: null,
      isActive: true,
      isDefault: false,
      position: 1,
    },
  ];
}

/** Per-field config for the checkout customer form. `name` is always visible;
 *  only its `required` flag is editable. */
export interface CustomerFieldConfig {
  visible: boolean;
  required: boolean;
}

export interface CustomerFieldsConfig {
  name: CustomerFieldConfig;
  phone: CustomerFieldConfig;
  email: CustomerFieldConfig;
}

export const DEFAULT_CUSTOMER_FIELDS: CustomerFieldsConfig = {
  name: { visible: true, required: true },
  phone: { visible: true, required: true },
  email: { visible: false, required: false },
};

/** Default weekdays with no delivery. Empty = deliveries every day. Values
 *  follow JS convention (0 = Sunday … 6 = Saturday). */
export const DEFAULT_DELIVERY_BLOCKED_WEEKDAYS: number[] = [];

/** Weekday options for the "días bloqueados" selector in the editor. Ordered
 *  Monday → Sunday for display but keyed with the JS day number. */
export const DELIVERY_WEEKDAY_OPTIONS: { day: number; label: string }[] = [
  { day: 1, label: 'Lunes' },
  { day: 2, label: 'Martes' },
  { day: 3, label: 'Miércoles' },
  { day: 4, label: 'Jueves' },
  { day: 5, label: 'Viernes' },
  { day: 6, label: 'Sábado' },
  { day: 0, label: 'Domingo' },
];

export type CatalogTemplate = 'classic' | 'banner-centered' | 'minimal';

export const CATALOG_TEMPLATES: {
  id: CatalogTemplate;
  name: string;
  description: string;
}[] = [
  { id: 'classic', name: 'Clásico', description: 'Logo en el navbar, sin banner' },
  { id: 'banner-centered', name: 'Centrado', description: 'Banner con logo superpuesto' },
  { id: 'minimal', name: 'Moderno', description: 'Banner con logo centrado debajo' },
];

export interface EcommerceConfig {
  tenantId: string;
  name: string;
  logo: string | null;
  banner: string | null;
  whatsappButtons: WhatsappButton[];
  description: string | null;
  isAcceptingOrders: boolean;
  isVisible: boolean;
  currency: string;
  currencySymbol: string;
  showReferencePrice: boolean;
  showLocalCurrencyPrice: boolean;
  themeColor: string;
  paymentMethods: PaymentMethod[];
  country: string | null;
  countryCode: string | null;
  state: string | null;
  city: string | null;
  showDesignSection: boolean;
  showPaymentMethodsSection: boolean;
  showLocationSection: boolean;
  showCategoriesSection: boolean;
  socialLinks: SocialLinks;
  template: CatalogTemplate;
  /** Idioma default del catálogo público (es/en/fr/pt). El visitante puede
   *  cambiarlo con el switcher del catálogo; esto define el inicial. */
  defaultLanguage: string;
  whatsappOrderMessage: string | null;
  /** When true, new orders trigger an email to the owner + team members
   *  with the `ordenes:view` permission. Toggled from the catalog editor
   *  on the "Notificaciones" tab. */
  notifyNewOrders: boolean;
  /** When true, sends a weekly summary email (Sunday) with the week's sales,
   *  orders, top products and traffic to the owner + team members with
   *  `ordenes:view`. Paid plans only. Editor "Notificaciones" tab. */
  notifyWeeklyReport: boolean;
  /** Shipping/delivery options offered at checkout (editor "Envío" tab). */
  shippingMethods: ShippingMethod[];
  /** Master toggle for the Envío section in the public checkout. */
  showShippingSection: boolean;
  /** Which customer fields to request at checkout and whether each is required. */
  customerFields: CustomerFieldsConfig;
  /** When true, the public checkout shows a delivery-date picker so the
   *  customer chooses the desired delivery date (persisted as `delivery_date`
   *  on the order). Otherwise the server default (CURRENT_DATE) is used.
   *  NOTE: persisted inside the `customer_fields` jsonb column (no dedicated
   *  DB column), see EcommerceConfigService. */
  deliveryDateEnabled: boolean;
  /** Weekdays with no delivery (JS convention 0 = Sunday … 6 = Saturday). The
   *  checkout date picker skips/blocks these days. Persisted inside the
   *  `customer_fields` jsonb column alongside `deliveryDateEnabled`. */
  deliveryBlockedWeekdays: number[];
}

/** Business hours for a single day. `dayOfWeek` follows JS convention:
 *  0 = Sunday … 6 = Saturday. */
export interface BusinessHoursDay {
  dayOfWeek: number;
  openTime: string;   // "HH:MM" or "HH:MM:SS"
  closeTime: string;
  isOpen: boolean;
}

/** A full week: always 7 entries (Sunday → Saturday) so the editor has a stable
 *  shape regardless of which days the tenant has saved. Days the tenant marked
 *  as closed still keep their open/close hours so the user can flip them on
 *  again without re-typing. */
export type BusinessHoursWeek = BusinessHoursDay[];

export const DAY_LABELS_ES: { day: number; label: string }[] = [
  { day: 1, label: 'Lunes' },
  { day: 2, label: 'Martes' },
  { day: 3, label: 'Miércoles' },
  { day: 4, label: 'Jueves' },
  { day: 5, label: 'Viernes' },
  { day: 6, label: 'Sábado' },
  { day: 0, label: 'Domingo' },
];

export const DEFAULT_BUSINESS_HOURS_WEEK: BusinessHoursWeek = [
  { dayOfWeek: 0, openTime: '08:00', closeTime: '20:00', isOpen: true },
  { dayOfWeek: 1, openTime: '08:00', closeTime: '20:00', isOpen: true },
  { dayOfWeek: 2, openTime: '08:00', closeTime: '20:00', isOpen: true },
  { dayOfWeek: 3, openTime: '08:00', closeTime: '20:00', isOpen: true },
  { dayOfWeek: 4, openTime: '08:00', closeTime: '20:00', isOpen: true },
  { dayOfWeek: 5, openTime: '08:00', closeTime: '20:00', isOpen: true },
  { dayOfWeek: 6, openTime: '08:00', closeTime: '20:00', isOpen: true },
];

export type ExchangeRateType = 'none' | 'bcv_usd' | 'bcv_eur' | 'custom';

export interface TenantCurrencyConfig {
  productCurrency: string;
  displayCurrency: string;
  exchangeRateType: ExchangeRateType;
  customRate: number | null;
  showDualCurrency: boolean;
  currencySymbol: string;
  decimalSeparator: string;
  thousandSeparator: string;
}

export const DEFAULT_CURRENCY_CONFIG: TenantCurrencyConfig = {
  productCurrency: 'USD',
  displayCurrency: 'USD',
  exchangeRateType: 'none',
  customRate: null,
  showDualCurrency: false,
  currencySymbol: '$',
  decimalSeparator: ',',
  thousandSeparator: '.',
};

/**
 * Default WhatsApp message template.
 * Variables: {nombre}, {telefono}, {productos}, {total}, {totalBs},
 *            {comentarios}, {metodoPago}, {envio}, {direccion}
 */
export const DEFAULT_WHATSAPP_ORDER_MESSAGE =
  `¡Hola! Me gustaría hacer un pedido:\n\n` +
  `*Nombre:* {nombre}\n` +
  `*Teléfono:* {telefono}\n\n` +
  `*Productos:*\n{productos}\n\n` +
  `*Total:* {total}{totalBs}\n\n` +
  `{envio}{direccion}{comentarios}{metodoPago}`;

export const WHATSAPP_MESSAGE_VARIABLES = [
  { key: '{nombre}', label: 'Nombre del cliente' },
  { key: '{telefono}', label: 'Teléfono del cliente' },
  { key: '{productos}', label: 'Lista de productos' },
  { key: '{total}', label: 'Total del pedido' },
  { key: '{totalBs}', label: 'Total en bolívares' },
  { key: '{envio}', label: 'Método de envío' },
  { key: '{direccion}', label: 'Dirección del cliente' },
  { key: '{comentarios}', label: 'Comentarios del cliente' },
  { key: '{metodoPago}', label: 'Método de pago' },
];

/**
 * Practical character limit for the raw message template.
 * wa.me URLs URL-encode the message — mobile browsers may truncate
 * URLs beyond ~2000-3000 encoded chars, so ~1000 raw chars is safe.
 */
export const WHATSAPP_MESSAGE_MAX_LENGTH = 1000;
