import { E } from '@shared/domain';
import { ProductList } from './product-list.model';
import { CreateProductInput } from './product.type';

export interface BaseProductService {
  getAll(): Promise<E.Either<Error, ProductList>>;
  create(input: CreateProductInput): Promise<E.Either<Error, void>>;
}
