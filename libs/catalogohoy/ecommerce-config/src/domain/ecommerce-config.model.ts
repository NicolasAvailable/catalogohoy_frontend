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

// ----------------------------------------------------------------- discounts ---

/** Kinds of discount a merchant can configure. Stored in `tenant_discounts.type`.
 *  - `code`            customer types a coupon code at checkout (validated by RPC).
 *  - `automatic`       flat discount applied automatically to every order.
 *  - `order_value`     applied automatically once the subtotal reaches `minOrder`.
 *  - `package`         applied automatically once the cart has `minItems` units.
 *  - `bogo`            buy X get Y (the cheapest qualifying units get a discount).
 *  - `free_shipping`   waives the shipping fee (optionally above `minOrder`).
 *  - `first_purchase`  applied only on the customer's first order. */
export type DiscountType =
  | 'code'
  | 'automatic'
  | 'order_value'
  | 'package'
  | 'bogo'
  | 'free_shipping'
  | 'first_purchase';

export type DiscountValueType = 'percent' | 'fixed';

/** "Buy" side of a BOGO rule: how many units must be in the cart to qualify. */
export interface BogoBuy {
  quantity: number;
}

/** "Get" side of a BOGO rule: how many of the cheapest remaining units get the
 *  discount, and how big that discount is (default 100% = free). */
export interface BogoGet {
  quantity: number;
  valueType: DiscountValueType;
  value: number;
}

/** A discount/coupon rule. Maps 1:1 to a `tenant_discounts` row. `id` is null
 *  until persisted. Code rules are validated server-side via the
 *  `validate_discount_code` RPC and never delivered through the public catalog;
 *  every other type ships inside `get_public_catalog.discounts`. */
export interface DiscountRule {
  id: number | null;
  name: string;
  type: DiscountType;
  /** Only for `code` rules. Case-insensitive, unique per tenant. */
  code: string | null;
  /** How the discount value is interpreted. Null for `free_shipping`/`bogo`. */
  valueType: DiscountValueType | null;
  value: number;
  /** Minimum subtotal to qualify (order_value / free_shipping / code). */
  minOrder: number;
  /** Minimum total units in cart to qualify (package). */
  minItems: number;
  /** Whether the rule also waives the shipping fee. */
  freeShipping: boolean;
  bogoBuy: BogoBuy | null;
  bogoGet: BogoGet | null;
  /** Optional cap on total redemptions. Null = unlimited. */
  usageLimit: number | null;
  usageCount: number;
  /** ISO timestamps bounding when the rule is valid. Null = open-ended. */
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  position: number;
}

/** The trimmed shape of an automatic rule delivered through the public catalog
 *  (`get_public_catalog.discounts`). Codes are NEVER included here — they are
 *  validated server-side via `validate_discount_code`. */
export interface PublicDiscount {
  id: number;
  name: string;
  type: Exclude<DiscountType, 'code'>;
  valueType: DiscountValueType | null;
  value: number;
  minOrder: number;
  minItems: number;
  freeShipping: boolean;
  bogoBuy: BogoBuy | null;
  bogoGet: BogoGet | null;
  position: number;
}

export const DISCOUNT_TYPE_OPTIONS: {
  label: string;
  value: DiscountType;
  description: string;
}[] = [
  {
    label: 'Código de cupón',
    value: 'code',
    description: 'El cliente escribe un código en el checkout.',
  },
  {
    label: 'Descuento automático',
    value: 'automatic',
    description: 'Se aplica a todos los pedidos sin código.',
  },
  {
    label: 'Por monto del pedido',
    value: 'order_value',
    description: 'Se aplica al superar un monto mínimo.',
  },
  {
    label: 'Por cantidad (paquete)',
    value: 'package',
    description: 'Se aplica al llevar una cantidad mínima de productos.',
  },
  {
    label: 'Compra X lleva Y (BOGO)',
    value: 'bogo',
    description: 'Lleva varias unidades y obtén otras con descuento.',
  },
  {
    label: 'Envío gratis',
    value: 'free_shipping',
    description: 'Elimina el costo de envío del pedido.',
  },
  {
    label: 'Primera compra',
    value: 'first_purchase',
    description: 'Solo para el primer pedido del cliente.',
  },
];

export const DISCOUNT_VALUE_TYPE_OPTIONS: {
  label: string;
  value: DiscountValueType;
}[] = [
  { label: 'Porcentaje (%)', value: 'percent' },
  { label: 'Monto fijo', value: 'fixed' },
];

export function createDefaultDiscountRule(position: number): DiscountRule {
  return {
    id: null,
    name: '',
    type: 'automatic',
    code: null,
    valueType: 'percent',
    value: 10,
    minOrder: 0,
    minItems: 0,
    freeShipping: false,
    bogoBuy: null,
    bogoGet: null,
    usageLimit: null,
    usageCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    position,
  };
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
 *            {descuento}, {comentarios}, {metodoPago}, {envio}, {direccion}
 */
export const DEFAULT_WHATSAPP_ORDER_MESSAGE =
  `¡Hola! Me gustaría hacer un pedido:\n\n` +
  `*Nombre:* {nombre}\n` +
  `*Teléfono:* {telefono}\n\n` +
  `*Productos:*\n{productos}\n\n` +
  `{descuento}*Total:* {total}{totalBs}\n\n` +
  `{envio}{direccion}{comentarios}{metodoPago}`;

export const WHATSAPP_MESSAGE_VARIABLES = [
  { key: '{nombre}', label: 'Nombre del cliente' },
  { key: '{telefono}', label: 'Teléfono del cliente' },
  { key: '{productos}', label: 'Lista de productos' },
  { key: '{total}', label: 'Total del pedido' },
  { key: '{totalBs}', label: 'Total en bolívares' },
  { key: '{descuento}', label: 'Descuento aplicado' },
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
