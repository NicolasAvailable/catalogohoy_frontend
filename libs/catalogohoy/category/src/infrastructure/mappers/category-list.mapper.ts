import { CategoryList } from '../../domain';
import { CategoryEntity } from '../entities';
import { CategoryMapper } from './category.mapper';

export class CategoryListMapper {
  static toDomain(entities: CategoryEntity[]): CategoryList {
    return CategoryList.from(entities.map(CategoryMapper.toDomain));
  }
}
