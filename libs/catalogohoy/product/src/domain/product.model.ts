import { CategoryList } from '@catalogohoy/category';
import { Entity } from '@shared/domain';

export interface WholesaleTier {
  title: string;
  price: number;
}

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
    public readonly productionCost: number | null,
    public readonly position: number,
    public readonly isWholesale: boolean,
    public readonly wholesaleTiers: WholesaleTier[],
    public readonly isSoldOut: boolean,
    public readonly isHidden: boolean
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
      primitives.productionCost,
      primitives.position,
      primitives.isWholesale,
      primitives.wholesaleTiers,
      primitives.isSoldOut,
      primitives.isHidden
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
  position: number;
  isWholesale: boolean;
  wholesaleTiers: WholesaleTier[];
  isSoldOut: boolean;
  isHidden: boolean;
}
