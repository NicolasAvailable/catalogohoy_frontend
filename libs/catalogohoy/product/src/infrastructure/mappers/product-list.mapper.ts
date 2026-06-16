import { CategoryListMapper } from '@catalogohoy/category';
import { Product } from '../../domain';
import { ProductList } from '../../domain/product-list.model';
import { ProductEntity } from '../entities';

export class ProductListMapper {
  static toDomain(entities: ProductEntity[]): ProductList {
    return ProductList.from(
      entities.map((entity) =>
        Product.fromPrimitives({
          id: entity.id,
          name: entity.name,
          description: entity.description,
          price: entity.price,
          pricePromotional: entity.price_promotional ?? 0,
          authUserId: entity.auth_user_id,
          photos: entity.photos,
          stock: entity.stock,
          categoryList: CategoryListMapper.toDomain(
            entity.product_categories ?? []
          ),
          createdAt: entity.created_at,
          sku: entity.sku,
          productionCost: entity.production_cost,
          position: entity.position ?? 0,
          isWholesale: entity.is_wholesale ?? false,
          wholesaleTiers: entity.wholesale_tiers ?? [],
          isSoldOut: entity.is_sold_out ?? false,
          isHidden: entity.is_hidden ?? false,
          isSized: entity.is_sized ?? false,
          sizes: entity.sizes ?? [],
          isVariant: entity.is_variant ?? false,
          variants: (entity.variants ?? []).map((v) => ({
            ...v,
            photos: v.photos ?? [],
            sizes: v.sizes ?? [],
          })),
        })
      )
    );
  }
}
