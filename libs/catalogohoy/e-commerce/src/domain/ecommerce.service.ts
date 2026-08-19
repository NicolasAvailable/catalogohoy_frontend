import {
  CatalogTemplate,
  CustomerFieldsConfig,
  PaymentMethodEntity,
  ShippingMethod,
  SocialLinks,
  TenantCurrencyConfig,
  WhatsappButton,
} from '@catalogohoy/ecommerce-config';
import { Product, ProductList } from '@catalogohoy/product';
import { E } from '@shared/domain';

export interface BusinessHoursDay {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

export interface CatalogInfo {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  banner: string | null;
  whatsappButtons: WhatsappButton[];
  openTime: string;
  closeTime: string;
  isOpen: boolean;
  businessHoursWeek: BusinessHoursDay[];
  themeColor: string;
  /** Idioma default del catálogo (es/en/fr/pt) configurado por el tenant. */
  defaultLanguage: string;
  showDesignSection: boolean;
  paymentMethods: PaymentMethodEntity[];
  showPaymentMethodsSection: boolean;
  socialLinks: SocialLinks;
  template: CatalogTemplate;
  currencySymbol: string;
  showReferencePrice: boolean;
  showLocalCurrencyPrice: boolean;
  whatsappOrderMessage: string | null;
  country: string | null;
  countryCode: string | null;
  state: string | null;
  city: string | null;
  showLocationSection: boolean;
  showCategoriesSection: boolean;
  currencyConfig: TenantCurrencyConfig | null;
  /** Shipping options the customer can choose at checkout. */
  shippingMethods: ShippingMethod[];
  /** Whether to render the Envío section in the checkout. */
  showShippingSection: boolean;
  /** Which customer fields to request and whether each is required. */
  customerFields: CustomerFieldsConfig;
  /** When true, the checkout shows a delivery-date picker for the customer. */
  deliveryDateEnabled: boolean;
  /** Weekdays with no delivery (JS: 0 = Sunday … 6 = Saturday). The date
   *  picker blocks these days. */
  deliveryBlockedWeekdays: number[];
}

/** Invoice-safe view of an order, fetched by id for the public receipt. */
export interface PublicOrder {
  id: number;
  /** Per-tenant display number (#N) — the same one the admin receipt shows. */
  orderNumber: number | null;
  status: string;
  name: string;
  phone: string | null;
  email: string | null;
  products: {
    productId?: string | number;
    name: string;
    quantity: number;
    price: number;
    total: number;
    size?: string | null;
    sku?: string | null;
    photo?: string;
    /** Paid extras added to this line at checkout (name + per-unit price +
     *  quantity; quantity absent = 1). */
    addons?:
      | { id?: string; name: string; price: number; quantity?: number }[]
      | null;
  }[];
  totalUsd: number;
  totalBs: number | null;
  shippingMethod: { name: string; type: string; fee: number } | null;
  shippingAddress: string | null;
  shippingFee: number;
  paymentMethod: string | null;
  comments: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  /** The seeded default "Ver todos" row — clicking it clears the active
   *  filter on the public catalog (acts as a show-all pill). */
  isViewAll?: boolean;
}

export interface PaginatedProductList {
  productList: ProductList;
  totalCount: number;
}

export interface PublicCatalogData {
  catalogInfo: CatalogInfo;
  categories: Category[];
  /** True cuando el tenant OCULTÓ su categoría "Ver todos" (la fila is_view_all
   *  existe pero is_visible=false): el catálogo no debe renderizar ningún tab
   *  de "Ver todos" (ni el seedeado ni el sintético), pero sigue mostrando
   *  todos los productos por defecto. */
  viewAllHidden: boolean;
  exchangeRate: number;
  planExpired: boolean;
  isFreePlan: boolean;
}

export interface BaseEcommerceService {
  getPublicCatalog(slug: string): Promise<E.Either<Error, PublicCatalogData>>;
  getCatalogInfo(slug: string): Promise<E.Either<Error, CatalogInfo>>;
  getProducts(
    slug: string,
    search?: string,
    categoryId?: string,
    orderBy?: 'name' | 'price_asc' | 'price_desc',
    page?: number,
    pageSize?: number,
    tenantId?: string,
    cap?: number
  ): Promise<E.Either<Error, PaginatedProductList>>;
  getProductById(id: string): Promise<E.Either<Error, Product>>;
  /** Max products the free plan allows — the public-catalog cap for downgraded
   *  (free) tenants. Read from the `plans` table (public). */
  getFreePlanMaxProducts(): Promise<number>;
  getCategories(slug: string): Promise<E.Either<Error, Category[]>>;
  createOrder(order: {
    tenant_id: number;
    name: string;
    products: any[];
    total_usd: number;
    phone: string;
    comments: string;
    email?: string;
    payment_method?: string;
    shipping_method?: {
      name: string;
      type: 'pickup' | 'delivery' | 'shipping';
      fee: number;
    } | null;
    shipping_address?: string | null;
    shipping_fee?: number;
  }): Promise<E.Either<Error, { id: number }>>;
  getPublicOrder(id: number): Promise<E.Either<Error, PublicOrder>>;
}
