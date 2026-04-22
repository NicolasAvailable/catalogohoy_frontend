import { E } from '@shared/domain';
import { CategoryList } from './category-list.model';
import { Category } from './category.model';
import { CreateCategoryInput, UpdateCategoryInput } from './category.type';

export interface CategoryListPage {
  list: CategoryList;
  /** Total number of categories across all pages (server count). */
  total: number;
}

export interface BaseCategoryService {
  getAll(
    page?: number,
    pageSize?: number
  ): Promise<E.Either<Error, CategoryListPage>>;
  getById(id: string): Promise<E.Either<Error, Category>>;
  create(input: CreateCategoryInput): Promise<E.Either<Error, Category>>;
  update(input: UpdateCategoryInput): Promise<E.Either<Error, void>>;
  delete(id: string): Promise<E.Either<Error, void>>;
}
