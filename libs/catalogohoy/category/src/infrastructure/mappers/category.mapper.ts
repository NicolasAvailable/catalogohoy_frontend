import { Category } from '../../domain';
import { CategoryEntity } from '../entities';

export class CategoryMapper {
  static toDomain(entity: CategoryEntity): Category {
    return Category.create({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      isVisible: entity.is_visible,
      position: entity.position,
      authUserId: entity.auth_user_id,
      createdAt: entity.created_at,
    });
  }
}
