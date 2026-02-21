import { CategoryList } from '@catalogohoy/category';
import { Entity } from '@shared/domain';

export class Product extends Entity {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
    public readonly pricePromotional: number,
    public readonly photos: string[],
    public readonly stock: string | null,
    public readonly categoryList: CategoryList,
    public readonly authUserId: string,
    public readonly createdAt: string,
    public readonly sku: string | null,
    public readonly productionCost: number | null
  ) {
    super();
  }

  public static fromPrimitives(primitives: ProductPrimitives) {
    return new Product(
      primitives.name,
      primitives.description,
      primitives.price,
      primitives.pricePromotional,
      primitives.photos,
      primitives.stock,
      primitives.categoryList,
      primitives.authUserId,
      primitives.createdAt,
      primitives.sku,
      primitives.productionCost
    ).withId(primitives.id);
  }
}

export interface ProductPrimitives {
  id: string;
  name: string;
  description: string;
  price: number;
  pricePromotional: number;
  photos: string[];
  stock: string | null;
  categoryList: CategoryList;
  authUserId: string;
  createdAt: string;
  sku: string | null;
  productionCost: number | null;
}
