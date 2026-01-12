import { Product } from '../../domain';
import { ProductList } from '../../domain/product-list.model';
import { ProductEntity } from '../entities';

export class ProductListMapper {
  static toDomain(entities: ProductEntity[]): ProductList {
    return ProductList.from(
      entities.map((entity) =>
        Product.create({
          id: entity.id,
          name: entity.name,
          description: entity.description,
          price: entity.price,
          pricePromotional: entity.price_promotional,
          authUserId: entity.auth_user_id,
          photos: entity.photos,
          createdAt: entity.created_at,
        })
      )
    );
  }
}
