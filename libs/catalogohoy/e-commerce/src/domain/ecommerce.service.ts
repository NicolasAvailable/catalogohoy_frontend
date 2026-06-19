import {
  CatalogTemplate,
  CustomerFieldsConfig,
  PaymentMethodEntity,
  PublicDiscount,
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
  /** Automatic discount rules (non-code) the checkout engine evaluates. */
  discounts: PublicDiscount[];
}

/** Result of validating a coupon code at checkout (RPC validate_discount_code). */
export interface DiscountValidation {
  valid: boolean;
  id?: number;
  name?: string;
  code?: string;
  valueType?: 'percent' | 'fixed';
  value?: number;
  freeShipping?: boolean;
  /** Reason when invalid: 'not_found' | 'usage_limit' | 'min_order'. */
  error?: string;
  minOrder?: number;
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
  }[];
  totalUsd: number;
  totalBs: number | null;
  shippingMethod: { name: string; type: string; fee: number } | null;
  shippingAddress: string | null;
  shippingFee: number;
  discountAmount: number;
  discountCode: string | null;
  discountLabel: string | null;
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
    discount_amount?: number;
    discount_code?: string | null;
    discount_label?: string | null;
  }): Promise<E.Either<Error, { id: number }>>;
  getPublicOrder(id: number): Promise<E.Either<Error, PublicOrder>>;
  /** Validate a coupon code against the tenant's rules (server-side RPC). */
  validateDiscountCode(
    slug: string,
    code: string,
    subtotal: number,
    phone?: string
  ): Promise<E.Either<Error, DiscountValidation>>;
  /** Whether the given phone has no prior orders in the tenant (first-purchase). */
  isFirstPurchase(slug: string, phone: string): Promise<boolean>;
}
