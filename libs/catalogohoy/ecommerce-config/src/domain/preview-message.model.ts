import {
  CatalogTemplate,
  PaymentMethodEntity,
  SocialLinks,
} from './ecommerce-config.model';

export interface PreviewMessage {
  type: 'PREVIEW_UPDATE' | 'PREVIEW_ENTER' | 'PREVIEW_EXIT';
  payload: Partial<{
    name: string;
    logo: string | null;
    banner: string | null;
    themeColor: string;
    /** Opciones de diseño en vivo (CAT-103). */
    look: Record<string, unknown> | null;
    showDesignSection: boolean;
    showCategoriesSection: boolean;
    showStock: boolean;
    sortAlphabetically: boolean;
    socialLinks: SocialLinks;
    template: CatalogTemplate;
    currencySymbol: string;
    /** Métodos de pago activos (con sus datos) para reflejar el checkout live. */
    paymentMethods: PaymentMethodEntity[];
  }>;
  source: 'catalogohoy-admin';
}
