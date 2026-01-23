import { EntityList } from '@shared/domain';
import { Category } from './category.model';

export class CategoryList extends EntityList<Category> {
  constructor(public readonly categories: Category[]) {
    super(CategoryList, categories);
  }

  public static from(categories: Category[]) {
    return new CategoryList(categories);
  }

  public static empty() {
    return new CategoryList([]);
  }
}
