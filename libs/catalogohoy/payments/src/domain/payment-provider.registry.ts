import { PaymentConnectionType, PaymentProviderId } from './payment';

export interface PaymentCredentialField {
  /** Clave lógica que mapea a PaymentCredentialsInput. */
  key: 'secretKey' | 'publicKey';
  label: string;
  /** true → se enmascara en la UI y no se devuelve al frontend tras guardar. */
  secret: boolean;
  placeholder?: string;
  hint?: string;
}

export interface PaymentProviderMeta {
  id: PaymentProviderId;
  name: string;
  /** Ícono Lucide para la tarjeta del proveedor. */
  icon: string;
  connectionType: PaymentConnectionType;
  /** Países ISO-3166-1 alpha-2 donde aplica. '*' = global. */
  countries: readonly string[] | '*';
  /** Campos que el comerciante completa (modo api_keys). */
  credentialFields: readonly PaymentCredentialField[];
  /** Monedas que puede cobrar (informativo / validación). */
  currencies?: readonly string[];
  /** Dónde saca sus llaves (link al panel del proveedor). */
  docsUrl: string;
  /** Ayuda corta de dónde obtener las credenciales. */
  credentialsHelp?: string;
}

/**
 * Registro de pasarelas. El orden define la prioridad de aparición en el tab
 * "Pagos automáticos". `countries` alimenta el gating: en producción sólo se
 * muestran las que aplican al país del catálogo.
 */
export const PAYMENT_PROVIDERS: readonly PaymentProviderMeta[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    icon: 'credit-card',
    connectionType: 'api_keys',
    countries: '*',
    credentialFields: [
      { key: 'publicKey', label: 'Publishable key', secret: false, placeholder: 'pk_live_…' },
      { key: 'secretKey', label: 'Secret key', secret: true, placeholder: 'sk_live_…' },
    ],
    currencies: ['USD', 'EUR', 'MXN', 'BRL'],
    docsUrl: 'https://dashboard.stripe.com/apikeys',
    credentialsHelp: 'Stripe Dashboard → Developers → API keys.',
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    icon: 'wallet',
    // Paste-key por ahora (el comerciante usa su propio Access Token).
    // OAuth queda como mejora cuando la plataforma tenga cuenta MP.
    connectionType: 'api_keys',
    countries: ['AR', 'MX', 'CO', 'CL', 'PE', 'BR', 'UY'],
    credentialFields: [
      { key: 'publicKey', label: 'Public Key', secret: false, placeholder: 'APP_USR-…' },
      { key: 'secretKey', label: 'Access Token', secret: true, placeholder: 'APP_USR-…' },
    ],
    docsUrl: 'https://www.mercadopago.com/developers/panel/app',
    credentialsHelp:
      'Mercado Pago → Developers → Tus integraciones → Credenciales de producción.',
  },
  {
    id: 'wompi',
    name: 'Wompi',
    icon: 'wallet',
    connectionType: 'api_keys',
    countries: ['CO'],
    credentialFields: [
      { key: 'publicKey', label: 'Llave pública', secret: false, placeholder: 'pub_prod_…' },
      { key: 'secretKey', label: 'Llave privada', secret: true, placeholder: 'prv_prod_…' },
    ],
    currencies: ['COP'],
    docsUrl: 'https://comercios.wompi.co',
    credentialsHelp: 'Panel de Wompi → Desarrolladores → Llaves de API.',
  },
  {
    id: 'culqi',
    name: 'Culqi',
    icon: 'credit-card',
    connectionType: 'api_keys',
    countries: ['PE'],
    credentialFields: [
      { key: 'publicKey', label: 'Llave pública', secret: false, placeholder: 'pk_live_…' },
      { key: 'secretKey', label: 'Llave secreta', secret: true, placeholder: 'sk_live_…' },
    ],
    currencies: ['PEN', 'USD'],
    docsUrl: 'https://docs.culqi.com',
    credentialsHelp: 'Panel de Culqi → Desarrollo → API Keys.',
  },
  {
    id: 'flow',
    name: 'Flow',
    icon: 'wallet',
    connectionType: 'api_keys',
    countries: ['CL'],
    credentialFields: [
      { key: 'publicKey', label: 'API Key', secret: false },
      { key: 'secretKey', label: 'Secret Key', secret: true },
    ],
    currencies: ['CLP'],
    docsUrl: 'https://www.flow.cl/docs/api.html',
    credentialsHelp: 'Panel de Flow → Configuración → API.',
  },
];

export function getProviderMeta(
  id: PaymentProviderId
): PaymentProviderMeta | undefined {
  return PAYMENT_PROVIDERS.find((p) => p.id === id);
}

/**
 * Pasarelas a mostrar para un país. En desarrollo pasá `showAll = true` para
 * verlas todas y probarlas; en producción se filtra por el country_code del
 * catálogo (las globales '*' siempre aparecen).
 */
export function providersForCountry(
  countryCode: string | null | undefined,
  showAll = false
): readonly PaymentProviderMeta[] {
  if (showAll) return PAYMENT_PROVIDERS;
  const cc = (countryCode ?? '').toUpperCase();
  return PAYMENT_PROVIDERS.filter(
    (p) =>
      p.countries === '*' ||
      (Array.isArray(p.countries) && p.countries.includes(cc))
  );
}
