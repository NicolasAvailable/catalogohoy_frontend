import { Product, ProductList } from '@catalogohoy/product';
import { E } from '@shared/domain';

export interface CatalogInfo {
  name: string;
  whatsapp: string;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface BaseEcommerceService {
  getCatalogInfo(slug: string): Promise<E.Either<Error, CatalogInfo>>;
  getProducts(
    slug: string,
    search?: string,
    categoryId?: string,
    orderBy?: 'name' | 'price_asc' | 'price_desc'
  ): Promise<E.Either<Error, ProductList>>;
  getProductById(id: string): Promise<E.Either<Error, Product>>;
  getCategories(slug: string): Promise<E.Either<Error, Category[]>>;
}
