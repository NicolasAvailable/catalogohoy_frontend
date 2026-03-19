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
  themeColor: string;
  paymentMethods: PaymentMethod[];
  state: string | null;
  city: string | null;
  showDesignSection: boolean;
  showPaymentMethodsSection: boolean;
  showLocationSection: boolean;
  socialLinks: SocialLinks;
  template: CatalogTemplate;
}
