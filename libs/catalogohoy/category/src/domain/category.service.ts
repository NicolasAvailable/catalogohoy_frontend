import { E } from '@shared/domain';
import { CategoryList } from './category-list.model';
import { Category } from './category.model';
import { CreateCategoryInput, UpdateCategoryInput } from './category.type';

export interface BaseCategoryService {
  getAll(
    page?: number,
    pageSize?: number
  ): Promise<E.Either<Error, CategoryList>>;
  getById(id: string): Promise<E.Either<Error, Category>>;
  create(input: CreateCategoryInput): Promise<E.Either<Error, void>>;
  update(input: UpdateCategoryInput): Promise<E.Either<Error, void>>;
  delete(id: string): Promise<E.Either<Error, void>>;
}
