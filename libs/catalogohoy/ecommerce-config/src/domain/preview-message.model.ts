import { SocialLinks } from './ecommerce-config.model';

export interface PreviewMessage {
  type: 'PREVIEW_UPDATE' | 'PREVIEW_ENTER' | 'PREVIEW_EXIT';
  payload: Partial<{
    name: string;
    logo: string | null;
    banner: string | null;
    themeColor: string;
    showDesignSection: boolean;
    socialLinks: SocialLinks;
  }>;
  source: 'catalogohoy-admin';
}
