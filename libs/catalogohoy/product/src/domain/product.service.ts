import { E } from '@shared/domain';
import { ProductList } from './product-list.model';
import { Product } from './product.model';
import { CreateProductInput, ReplaceCategoriesInput, UpdateProductInput } from './product.type';

export interface BaseProductService {
  getAll(
    page?: number,
    pageSize?: number,
    search?: string
  ): Promise<E.Either<Error, ProductList>>;
  getById(id: string): Promise<E.Either<Error, Product>>;
  create(input: CreateProductInput): Promise<E.Either<Error, void>>;
  update(input: UpdateProductInput): Promise<E.Either<Error, void>>;
  delete(id: string): Promise<E.Either<Error, void>>;
  deleteMany(ids: string[]): Promise<E.Either<Error, void>>;
  replaceCategories(input: ReplaceCategoriesInput): Promise<E.Either<Error, void>>;
}
