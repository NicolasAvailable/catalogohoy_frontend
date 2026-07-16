import { CategoryListMapper } from '@catalogohoy/category';
import { Product } from '../../domain';
import { ProductEntity } from '../entities';

export class ProductMapper {
  public static toDomain(entity: ProductEntity): Product {
    return Product.fromPrimitives({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      price: entity.price,
      pricePromotional: entity.price_promotional ?? 0,
      photos: entity.photos,
      stock: entity.stock,
      authUserId: entity.auth_user_id,
      categoryList: CategoryListMapper.toDomain(entity.product_categories),
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
      addons: entity.addons ?? [],
    });
  }
}
