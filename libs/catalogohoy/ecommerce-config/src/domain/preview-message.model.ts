import { CatalogTemplate, SocialLinks } from './ecommerce-config.model';

export interface PreviewMessage {
  type: 'PREVIEW_UPDATE' | 'PREVIEW_ENTER' | 'PREVIEW_EXIT';
  payload: Partial<{
    name: string;
    logo: string | null;
    banner: string | null;
    themeColor: string;
    showDesignSection: boolean;
    showCategoriesSection: boolean;
    socialLinks: SocialLinks;
    template: CatalogTemplate;
    currencySymbol: string;
  }>;
  source: 'catalogohoy-admin';
}
