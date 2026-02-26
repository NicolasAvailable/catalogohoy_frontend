import { PaymentMethodEntity, WhatsappButton } from '@catalogohoy/ecommerce-config';
import { Product, ProductList } from '@catalogohoy/product';
import { E } from '@shared/domain';

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
  themeColor: string;
  showDesignSection: boolean;
  paymentMethods: PaymentMethodEntity[];
  showPaymentMethodsSection: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface PaginatedProductList {
  productList: ProductList;
  totalCount: number;
}

export interface BaseEcommerceService {
  getCatalogInfo(slug: string): Promise<E.Either<Error, CatalogInfo>>;
  getProducts(
    slug: string,
    search?: string,
    categoryId?: string,
    orderBy?: 'name' | 'price_asc' | 'price_desc',
    page?: number,
    pageSize?: number
  ): Promise<E.Either<Error, PaginatedProductList>>;
  getProductById(id: string): Promise<E.Either<Error, Product>>;
  getCategories(slug: string): Promise<E.Either<Error, Category[]>>;
  createOrder(order: {
    tenant_id: number;
    name: string;
    products: any[];
    total_usd: number;
    phone: string;
    comments: string;
    payment_method?: string;
  }): Promise<E.Either<Error, void>>;
}
